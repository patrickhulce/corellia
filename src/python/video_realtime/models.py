from dataclasses import dataclass
from typing import List
from python.video_realtime.structs import BoundingBox

import onnxruntime as rt
import tensorrt as trt
import pycuda.driver as cuda

import cv2
import torch
import numpy as np
import cupy as cp

import cupyx.scipy.ndimage

@dataclass
class FaceSwapEngine:
    engine: trt.ICudaEngine
    device_context: cuda.Device
    context: trt.IExecutionContext
    inputs: List[cuda.DeviceAllocation]
    outputs: List[cuda.DeviceAllocation]
    onnx_session: rt.InferenceSession

    def destroy(self):
        print('Destroying FaceSwapEngine...')
        for input in self.inputs:
            input.free()
        for output in self.outputs:
            output.free()

        del self.context

        self.device_context.pop()
        self.device_context.detach()
        del self.device_context
        print('Destroyed FaceSwapEngine!')

def init_faceswap():
    cuda.init()
    device = cuda.Device(0)  # Assuming you want to use GPU 0
    device_context = device.make_context()  # Create a context on the device.

    # Load the TensorRT engine
    with open(".data/models/faceswap.engine", "rb") as f, trt.Runtime(trt.Logger()) as runtime:
        engine = runtime.deserialize_cuda_engine(f.read())

    # Create a context for the engine
    context = engine.create_execution_context()

    # Allocate device memory for inputs and outputs
    inputs = [cuda.mem_alloc(512*512*3*4)]
    outputs = [cuda.mem_alloc(512*512*4*4)]

    onnx_session = rt.InferenceSession(".data/models/faceswap.onnx")

    return FaceSwapEngine(engine, device_context, context, inputs, outputs, onnx_session)

def run_faceswap(faceswap_engine: FaceSwapEngine, frame: np.ndarray, faces: List[BoundingBox]) -> np.ndarray:
    if len(faces) == 0:
        return frame

    # Convert the frame to a tensor
    frame_tensor = torch.from_numpy(frame.get())

    # Extract the faces from the frame
    face_tensors = [ frame_tensor[face.top:face.top+face.height, face.left:face.left+face.width, :] for face in faces ]

    # Convert to CHW format
    face_tensors = [ face.permute(2, 0, 1) for face in face_tensors ]

    # Resize first face to 512x512
    face_tensor = torch.nn.functional.interpolate(face_tensors[0].unsqueeze(0), size=(512, 512), mode='bilinear', align_corners=False).squeeze(0)

    # Normalize the face
    face_tensor = face_tensor / 255.0

    # Convert the tensor to numpy array
    face_array = face_tensor.cpu().numpy().astype(np.float32)

    # face_array = np.expand_dims(face_array, axis=0)
    # swapped_face = faceswap_engine.session.run(['swap'], {'input': face_array})[0][0]

    # Copy the input data to the GPU
    cuda.memcpy_htod(faceswap_engine.inputs[0], face_array)

    # Run the model
    faceswap_engine.context.execute_v2(bindings=faceswap_engine.inputs + faceswap_engine.outputs)

    # Copy the output data back to the CPU
    swapped_face = np.empty((4, 512, 512), dtype=np.float32)
    cuda.memcpy_dtoh(swapped_face, faceswap_engine.outputs[0])

    # Go to cupy
    swapped_face = cp.asarray(swapped_face)

    # Go back to 255 HWC format
    swapped_face = (255 * swapped_face.transpose(1, 2, 0).clip(0, 1)).astype(cp.uint8)
    
    # Resize the swapped face to the original size
    zoom_factors = (faces[0].height / swapped_face.shape[0], faces[0].width / swapped_face.shape[1], 1)
    swapped_face = cupyx.scipy.ndimage.zoom(swapped_face, zoom_factors, order=1)  # order=1 for bilinear interpolation
    frame_4ch = cv2.cvtColor(frame.get(), cv2.COLOR_RGB2RGBA)

    # Copy the swapped face directly onto the frame
    # frame_4ch[faces[0].top:faces[0].top+faces[0].height, faces[0].left:faces[0].left+faces[0].width, :] = swapped_face
    # return frame_4ch

    frame_gpu = cv2.cuda.GpuMat(frame_4ch)
    overlay = cv2.cuda.GpuMat(swapped_face.get())
    roi_mat = cv2.cuda.GpuMat(frame_gpu, (faces[0].left, faces[0].top) + overlay.size())
    print('Overlay:', overlay.size(), overlay.type())
    print('ROI:', roi_mat.size(), roi_mat.type())
    cv2.cuda.alphaComp(overlay, roi_mat, cv2.cuda.ALPHA_OVER, roi_mat)

    return cp.asarray(frame_gpu.download())
