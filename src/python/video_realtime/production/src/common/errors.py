import numpy as np


def assert_chw(pixels: np.ndarray) -> None:
    channels, height, width = pixels.shape
    if channels != 3 and channels != 4:
        raise AssertionError(f"Expected CHW pixel arrangement, but got {pixels.shape}")
    
def assert_hwc(pixels: np.ndarray) -> None:
    height, width, channels = pixels.shape
    if channels != 3 and channels != 4:
        raise AssertionError(f"Expected HWC pixel arrangement, but got {pixels.shape}")
    