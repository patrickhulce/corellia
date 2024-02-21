from dataclasses import dataclass
from typing import Any, List
from python.video_realtime.image_manipulation import chwfloat2hwcint
from python.video_realtime.structs import BoundingBox

import onnxruntime as rt
import tensorrt as trt
import pycuda.driver as cuda

import cv2
import torch
import numpy as np
import cupy as cp

import cupyx.scipy.ndimage

from python.video_realtime.tensorrt2 import run_tensorrt

@dataclass
class FaceSwapEngine:
    engine: trt.ICudaEngine
    device_context: cuda.Device
    context: trt.IExecutionContext
    bindings: list[Any]
    inputs: List[cuda.DeviceAllocation]
    outputs: List[cuda.DeviceAllocation]
    onnx_session: rt.InferenceSession

    def destroy(self):
        print('Destroying FaceSwapEngine...')
        for input in self.inputs:
            input['device'].free()
        for output in self.outputs:
            output['device'].free()

        self.device_context.pop()
        del self.device_context
        print('Destroyed FaceSwapEngine!')

def init_faceswap():
    TENSORRT_ENGINE_PATH = ".data/models/faceswap.engine"
    ONNX_MODEL_PATH = ".data/models/faceswap.onnx"

    cuda.init()
    device = cuda.Device(0)  # Assuming you want to use GPU 0
    device_context = device.make_context()  # Create a context on the device.

    def load_engine(engine_path):
        print('TRT VERSION', trt.__version__)
        TRT_LOGGER = trt.Logger(trt.Logger.VERBOSE)
        with open(engine_path, 'rb') as f, trt.Runtime(TRT_LOGGER) as runtime:
            return runtime.deserialize_cuda_engine(f.read())

    def allocate_buffers(engine):
        inputs, outputs, bindings = [], [], []
        for binding in engine:
            print("DOING BINDING!!!!")
            size = trt.volume(engine.get_binding_shape(binding))
            dtype = trt.nptype(engine.get_binding_dtype(binding))
            # Allocate host and device buffers
            host_mem = cuda.pagelocked_empty(size, dtype)
            device_mem = cuda.mem_alloc(host_mem.nbytes)
            # Append the device buffer to device bindings.
            bindings.append(int(device_mem))
            # Append to the appropriate list.
            if engine.binding_is_input(binding):
                inputs.append({'host': host_mem, 'device': device_mem})
            else:
                outputs.append({'host': host_mem, 'device': device_mem})
        return inputs, outputs, bindings


    engine = load_engine(TENSORRT_ENGINE_PATH)
    inputs, outputs, bindings = allocate_buffers(engine)
    context = engine.create_execution_context()
    # onnx_session = rt.InferenceSession(ONNX_MODEL_PATH)
    return FaceSwapEngine(engine, device_context, context, bindings, inputs, outputs, None)

def run_faceswap(faceswap_engine, frame: np.ndarray, faces: List[BoundingBox]) -> np.ndarray:
    if len(faces) == 0:
        return frame

    # return run_tensorrt(faceswap_engine, frame)
    # Convert the frame to a tensor
    frame_tensor = torch.from_numpy(frame)

    # Extract the faces from the frame
    face_tensors = [ frame_tensor[face.top:face.top+face.height, face.left:face.left+face.width, :] for face in faces ]

    # Convert to CHW format
    face_tensors = [ face.permute(2, 0, 1) for face in face_tensors ]

    # Resize first face to 512x512
    face_tensor = torch.nn.functional.interpolate(face_tensors[0].unsqueeze(0), size=(512, 512), mode='bilinear', align_corners=False).squeeze(0)

    # Normalize the face
    # face_tensor = face_tensor / 255.0

    # Convert the tensor to numpy array
    face_array = face_tensor.cpu().numpy().astype(np.float32) / 255.0
    # face_array = frame.copy()
    face_array = np.expand_dims(face_array, axis=0)
    # swapped_face = faceswap_engine.session.run(['swap'], {'input': face_array})[0][0]
    print("Input", face_array.shape, face_array.dtype, face_array.min(), face_array.max())
    print(face_array)
    # Transfer input data to the GPU.
    swapped_face = run_tensorrt(faceswap_engine, face_array)

    # Go to cupy
    # swapped_face = cp.asarray(swapped_face)

    # Go back to 255 HWC format
    swapped_face = swapped_face.transpose(1, 2, 0).clip(0, 1)
    swapped_face = (swapped_face * 255).astype(np.uint8)
    print('Swapped face:', swapped_face.shape, swapped_face.dtype, swapped_face.min(), swapped_face.max())
    # Resize the swapped face to the original size
    # zoom_factors = (faces[0].height / swapped_face.shape[0], faces[0].width / swapped_face.shape[1], 1)
    # swapped_face = cupyx.scipy.ndimage.zoom(swapped_face, zoom_factors, order=1)  # order=1 for bilinear interpolation
    swapped_face = cv2.resize(swapped_face, (faces[0].width, faces[0].height), interpolation=cv2.INTER_LINEAR)
    print('Frame:', frame.shape, frame.dtype, frame.min(), frame.max())
    frame_4ch = cv2.cvtColor(frame, cv2.COLOR_RGB2RGBA)
    print('Frame4CH:', frame_4ch.shape, frame_4ch.dtype, frame_4ch.min(), frame_4ch.max())
    # Copy the swapped face directly onto the frame
    print(faces[0])
    # frame_4ch[faces[0].top:faces[0].top+faces[0].height, faces[0].left:faces[0].left+faces[0].width, :] = swapped_face
    # return frame_4ch

    frame_gpu = cv2.cuda.GpuMat(frame_4ch)
    overlay = cv2.cuda.GpuMat(swapped_face)
    roi_mat = cv2.cuda.GpuMat(frame_gpu, (faces[0].left, faces[0].top) + overlay.size())
    print('Overlay:', overlay.size(), overlay.type())
    print('ROI:', roi_mat.size(), roi_mat.type())
    cv2.cuda.alphaComp(overlay, roi_mat, cv2.cuda.ALPHA_OVER, roi_mat)
    return frame_gpu.download()
    # return cp.asarray(frame_gpu.download())
