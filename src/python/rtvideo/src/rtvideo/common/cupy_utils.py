import logging
import time
from typing import Optional, Tuple, Union

import cupy as cp
import cupyx.scipy.ndimage
import onnxruntime as ort

log = logging.getLogger(__name__)


def cupy_resize_hwc(image: cp.ndarray, size: Tuple[int, int]) -> cp.ndarray:
    """
    API-compatible replacement for cv2.resize that works with CuPy arrays.
    """
    width, height = size
    current_width, current_height = image.shape[1], image.shape[0]
    return cupyx.scipy.ndimage.zoom(
        image, (height / current_height, width / current_width, 1)
    )


def cupy_insert(
    arr: cp.ndarray,
    index: int,
    values: cp.ndarray,
    axis: Optional[int] = 0,
) -> cp.ndarray:
    """
    API-compatible replacement for np.insert that works on 2D arrays.
    Inserts the values into the array at a specified index.
    """
    if axis is None:
        return cp.concatenate((arr[:index], values, arr[index:]), axis=axis)
    else:
        if axis == 0:
            return cp.concatenate((arr[:index, :], values, arr[index:, :]), axis=axis)
        elif axis == 1:
            values = cp.expand_dims(values, axis=0).T
            return cp.concatenate((arr[:, :index], values, arr[:, index:]), axis=axis)
        else:
            raise ValueError("Array axis is out of bounds")


def cupy_warp_affine(
    image: cp.ndarray,
    transformation_matrix: cp.ndarray,
    size: Tuple[int, int],
    borderValue: int = 0,
) -> cp.ndarray:
    """
    API-compatible replacement for cv2.warpAffine that works with CuPy arrays.
    """
    output = cp.zeros(size + (image.shape[2],), dtype=image.dtype)
    scale_adjust = cp.array([size[1] / image.shape[1], size[0] / image.shape[0]])
    transformation_matrix[:2, 2] *= scale_adjust

    for i in range(image.shape[2]):
        output[:, :, i] = cupyx.scipy.ndimage.affine_transform(
            image[:, :, i],
            transformation_matrix,
            offset=0,
            output_shape=size,
            mode="opencv",
            cval=borderValue,
        )

    return output


def run_onnx(
    session: Union[ort.InferenceSession, dict[int, ort.InferenceSession]],
    outputs: list[str],
    inputs: dict[str, cp.ndarray],
    output_device: Literal["cpu", "gpu"],
) -> list[cp.ndarray]:
    """
    Run an ONNX session with CuPy arrays without additional memory transfer.
    """
    input_device = next(iter(inputs.values())).device
    if isinstance(session, dict):
        session = session[input_device.id]

    session_options = session.get_provider_options()
    model_device_id = session_options.get("CUDAExecutionProvider", {}).get("device_id")
    if "CUDAExecutionProvider" not in session_options:
        raise ValueError("Session does not have CUDAExecutionProvider")
    if model_device_id != str(input_device.id):
        raise ValueError(
            f"Session device_id {model_device_id} does not match input device_id {input_device.id}"
        )

    binding = session.io_binding()
    for name, cp_input in inputs.items():
        contiguous_input = cp.ascontiguousarray(cp_input)
        binding.bind_input(
            name,
            device_type="cuda",
            device_id=contiguous_input.device.id,
            element_type=cp_input.dtype,
            shape=tuple(cp_input.shape),
            buffer_ptr=contiguous_input.data.ptr,
        )

    for name in outputs:
        if output_device == "cpu"
            binding.bind_output(name, device_type="cpu")
        else:
            binding.bind_output(
                name,
                device_type="cuda",
                device_id=input_device.id,
                element_type=cp.float32,
                shape=tuple(session.get_outputs()[0].shape),
            )

    # Ensure GPU operations are complete before passing data to ONNX Runtime
    log.debug(f"Running ONNX session on device {input_device.id}")
    start_time = time.time()
    input_device.synchronize()
    sync_time = time.time() - start_time
    session.run_with_iobinding(binding)
    run_time = time.time() - start_time - sync_time
    log.info(f"ONNX session ran in {run_time*1000:.1f}ms (sync: {sync_time* 1000:.1f}ms)")

    results: list[cp.ndarray] = []

    binding_outputs = binding.get_outputs()
    session_outputs = session.get_outputs()
    for i, name in enumerate(outputs):
        ort_output = binding_outputs[i]
        if output_device == "cpu":
            results.append(ort_output.numpy())
            continue

        if not ort_output.data_ptr():
            raise ValueError("Output failed to produce a data pointer")
        shape = session_outputs[i].shape
        bytes = cp.prod(cp.array(shape)) * cp.dtype(cp.float32).itemsize
        cuda_memory = cp.cuda.UnownedMemory(
            ort_output.data_ptr(), bytes, owner=ort_output
        )
        cuda_memory_ptr = cp.cuda.MemoryPointer(cuda_memory, 0)
        results.append(cp.ndarray(shape, dtype=cp.float32, memptr=cuda_memory_ptr))

    return results
