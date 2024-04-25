import argparse
import os
import random

import numpy as np
import torch
import tqdm
from arc2face import CLIPTextModelWrapper, image_align, project_face_embs
from diffusers import (
    ControlNetModel,
    DPMSolverMultistepScheduler,
    StableDiffusionControlNetPipeline,
    UNet2DConditionModel,
)
from gdl.datasets.ImageTestDataset import preprocess_for_emoca
from gdl.utils.FaceDetector import FAN
from gdl_apps.EMOCA.utils.load import load_model
from insightface.app import FaceAnalysis
from PIL import Image

HOME_DIR = os.environ.get("HOME", "")
ARC_2_FACE_DIR = os.environ.get("ARC_2_FACE_DIR", f"{HOME_DIR}/code/arc2face")

# global variable
MAX_SEED = np.iinfo(np.int32).max
if torch.cuda.is_available():
    device = "cuda"
    dtype = torch.float16
else:
    device = "cpu"
    dtype = torch.float32

# Load face detection and recognition package
app = FaceAnalysis(
    name="antelopev2",
    root=ARC_2_FACE_DIR,
    providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
)
app.prepare(ctx_id=0, det_size=(640, 640))

# Load pipeline
base_model = "runwayml/stable-diffusion-v1-5"
encoder = CLIPTextModelWrapper.from_pretrained(
    f"{ARC_2_FACE_DIR}/models", subfolder="encoder", torch_dtype=dtype
)
unet = UNet2DConditionModel.from_pretrained(
    f"{ARC_2_FACE_DIR}/models", subfolder="arc2face", torch_dtype=dtype
)
controlnet = ControlNetModel.from_pretrained(
    f"{ARC_2_FACE_DIR}/models", subfolder="controlnet", torch_dtype=dtype
)
pipeline = StableDiffusionControlNetPipeline.from_pretrained(
    base_model,
    text_encoder=encoder,
    unet=unet,
    controlnet=controlnet,
    torch_dtype=dtype,
    safety_checker=None,
)
pipeline.scheduler = DPMSolverMultistepScheduler.from_config(pipeline.scheduler.config)
pipeline = pipeline.to(device)

# Load Emoca
face_detector = FAN()
path_to_models = f"{ARC_2_FACE_DIR}/external/emoca/assets/EMOCA/models"
model_name = "EMOCA_v2_lr_mse_20"
mode = "detail"
emoca_model, conf = load_model(path_to_models, model_name, mode)
emoca_model.to(device)
emoca_model.eval()


def randomize_seed_fn(seed: int, randomize_seed: bool) -> int:
    if randomize_seed:
        seed = random.randint(0, MAX_SEED)
    return seed


def run_example(img_file, ref_img_file):
    return generate_image(img_file, ref_img_file, 25, 3, 23, 2, False)


def run_emoca(img, ref_img):
    img_dict = preprocess_for_emoca(img, face_detector)
    img_dict["image"] = img_dict["image"].unsqueeze(0).to(device)
    with torch.no_grad():
        codedict = emoca_model.encode(img_dict, training=False)

    bbox, bbox_type, landmarks = face_detector.run(
        np.array(ref_img.convert("RGB")), with_landmarks=True
    )
    if len(bbox) == 0:
        raise ValueError(
            "Face detection failed in reference image! Please try with another reference image."
        )
    if len(bbox) > 1:  # select largest face
        sizes = [(b[2] - b[0]) * (b[3] - b[1]) for b in bbox]
        idx = np.argmax(sizes)
        lmks = landmarks[idx]
    else:
        lmks = landmarks[0]
    ref_img_aligned = image_align(ref_img.copy(), lmks, output_size=512)
    ref_img_dict = preprocess_for_emoca(ref_img_aligned, face_detector)
    ref_img_dict["image"] = ref_img_dict["image"].unsqueeze(0).to(device)
    with torch.no_grad():
        ref_codedict = emoca_model.encode(ref_img_dict, training=False)
        ref_codedict["shapecode"] = codedict["shapecode"].clone()
        ref_codedict["detailcode"] = codedict["detailcode"].clone()
        tform = ref_img_dict["tform"].unsqueeze(0).to(device)
        tform = torch.inverse(tform).transpose(1, 2)
        visdict = emoca_model.decode(
            ref_codedict,
            training=False,
            render_orig=True,
            original_image=ref_img_dict["original_image"].unsqueeze(0).to(device),
            tform=tform,
        )

    cond_img = Image.fromarray(
        (
            (visdict["normal_images"][0] * 0.5 + 0.5)
            .clamp(0, 1)
            .permute(1, 2, 0)
            .cpu()
            .numpy()
            * 255
        ).astype(np.uint8)
    )

    return ref_img_aligned, cond_img


def generate_image(
    image_path, ref_image_path, num_steps, guidance_scale, seed, num_images
):
    pipeline.disable_lora()
    pipeline.scheduler = DPMSolverMultistepScheduler.from_config(
        pipeline.scheduler.config
    )

    if image_path is None:
        raise ValueError(
            "Cannot find any input face image! Please upload a face image."
        )

    if ref_image_path is None:
        raise ValueError(
            "Cannot find any reference image! Please upload a reference image."
        )

    img = np.array(Image.open(image_path))[:, :, ::-1]

    # Face detection and ID-embedding extraction
    faces = app.get(img)

    if len(faces) == 0:
        raise ValueError(
            "Face detection failed! Please try with another input face image."
        )

    faces = sorted(
        faces,
        key=lambda x: (x["bbox"][2] - x["bbox"][0]) * (x["bbox"][3] - x["bbox"][1]),
    )[-1]  # select largest face (if more than one detected)
    id_emb = torch.tensor(faces["embedding"], dtype=dtype)[None].to(device)
    id_emb = id_emb / torch.norm(id_emb, dim=1, keepdim=True)  # normalize embedding
    id_emb = project_face_embs(pipeline, id_emb)  # pass throught the encoder

    # pose extraction with EMOCA
    ref_img_a, cond_img = run_emoca(Image.open(image_path), Image.open(ref_image_path))

    generator = torch.Generator(device=device).manual_seed(seed)



    images = pipeline(
        image=cond_img,
        prompt_embeds=id_emb,
        num_inference_steps=num_steps,
        guidance_scale=guidance_scale,
        num_images_per_prompt=num_images,
        generator=generator,
    ).images

    return [ref_img_a, cond_img] + images


def read_directory(image_path):
    if os.path.isdir(image_path):
        return [
            os.path.join(image_path, f)
            for f in os.listdir(image_path)
            if os.path.isfile(os.path.join(image_path, f))
        ]
    return [image_path]


def main():
    # Parse all of our options from the command line.
    parser = argparse.ArgumentParser(
        description="Arc2Face ControlNet Runner"
    )

    parser.add_argument(
        "--image",
        type=str,
        default=f"{ARC_2_FACE_DIR}/assets/examples/joacquin.png",
        help="Path to the input image or directory",
    )

    parser.add_argument(
        "--ref_image",
        type=str,
        default=f"{ARC_2_FACE_DIR}/assets/examples/pose1.png",
        help="Path to the reference image or directory",
    )

    parser.add_argument(
        "--num_steps",
        type=int,
        default=25,
        help="Number of inference steps",
    )

    parser.add_argument(
        "--guidance_scale",
        type=float,
        default=3.0,
        help="Guidance scale",
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=23,
        help="Random seed",
    )

    parser.add_argument(
        "--num_images",
        type=int,
        default=4,
        help="Number of images to generate",
    )

    parser.add_argument(
        "--output_dir",
        type=str,
        default=".data",
        help="Output directory",
    )

    args = parser.parse_args()

    identities_to_use = read_directory(args.image)
    ref_images_to_use = read_directory(args.ref_image)

    print(f"About to process {len(ref_images_to_use)} poses on {identities_to_use}")

    generator = torch.Generator(device='cpu').manual_seed(args.seed)

    for identity in identities_to_use:
        # Process each image with overall progress bar.
        identity_basename = os.path.basename(identity).split(".")[0]

        print(f"Processing {identity_basename}...")
        pbar = tqdm.tqdm(ref_images_to_use)
        for ref_image in pbar:
            ref_basename = os.path.basename(ref_image).split(".")[0]
            pbar.set_description(f"{ref_basename}")
            next_random_seed = torch.randint(0, MAX_SEED - 1, (1,), generator=generator).item()
            try:
                images = generate_image(
                    identity,
                    ref_image,
                    args.num_steps,
                    args.guidance_scale,
                    next_random_seed,
                    args.num_images,
                )
            except Exception as e:
                print(f"Failed to generate image for {ref_basename}: {e}")
                continue

            for i, img in enumerate(images[2:]):
                img.save(
                    os.path.join(
                        args.output_dir,
                        f"{identity_basename}__{ref_basename}__{i}.jpg",
                    )
                )


main()
