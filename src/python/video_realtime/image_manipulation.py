import numpy as np

def chwfloat2hwcint(input: np.ndarray) -> np.ndarray:
    """Converts an array of floats to an array of integers."""
    output = input.transpose(1, 2, 0).clip(0, 1)
    return (output * 255).astype(np.uint8)

def hwcint2chwfloat(input: np.ndarray) -> np.ndarray:
    """Converts an array of integers to an array of floats."""
    output = input.astype(np.float32) / 255.0
    return output.transpose(2, 0, 1)