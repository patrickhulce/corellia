import os

import numpy as np
import torch
from arc2face import CLIPTextModelWrapper, project_face_embs
from diffusers import (
    DPMSolverMultistepScheduler,
    StableDiffusionPipeline,
    UNet2DConditionModel,
)
from insightface.app import FaceAnalysis
from PIL import Image

HOME_DIR = os.environ.get("HOME", "")
ARC_2_FACE_DIR = os.environ.get("ARC_2_FACE_DIR", f"{HOME_DIR}/code/arc2face")

base_model = "runwayml/stable-diffusion-v1-5"

encoder = CLIPTextModelWrapper.from_pretrained(
    f"{ARC_2_FACE_DIR}/models", subfolder="encoder", torch_dtype=torch.float16
)

unet = UNet2DConditionModel.from_pretrained(
    f"{ARC_2_FACE_DIR}/models", subfolder="arc2face", torch_dtype=torch.float16
)

pipeline = StableDiffusionPipeline.from_pretrained(
    base_model,
    text_encoder=encoder,
    unet=unet,
    torch_dtype=torch.float16,
    safety_checker=None,
)

pipeline.scheduler = DPMSolverMultistepScheduler.from_config(pipeline.scheduler.config)
pipeline = pipeline.to("cuda")

app = FaceAnalysis(
    name="antelopev2",
    root=ARC_2_FACE_DIR,
    providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
)
app.prepare(ctx_id=0, det_size=(640, 640))

img = np.array(Image.open(f"{ARC_2_FACE_DIR}/assets/examples/joacquin.png"))[:, :, ::-1]

faces = app.get(img)
faces = sorted(
    faces, key=lambda x: (x["bbox"][2] - x["bbox"][0]) * (x["bbox"][3] - x["bbox"][1])
)[-1]  # select largest face (if more than one detected)
id_emb = torch.tensor(faces["embedding"], dtype=torch.float16)[None].cuda()
id_emb = id_emb / torch.norm(id_emb, dim=1, keepdim=True)  # normalize embedding
id_emb = project_face_embs(pipeline, id_emb)  # pass through the encoder

num_images = 4
images = pipeline(
    prompt_embeds=id_emb,
    num_inference_steps=25,
    guidance_scale=3.0,
    num_images_per_prompt=num_images,
).images

# Save each image to a file in `.data/` directory
for i, image in enumerate(images):
    image.save(f".data/image_{i}.png")

print(images)
