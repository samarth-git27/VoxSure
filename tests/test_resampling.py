import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import numpy as np
from capture_stream import to_mono_16k

def test_same_rate():
    x = np.zeros(16000, dtype=np.float32)
    y = to_mono_16k(x, 16000)
    assert len(y) == 16000 and y.dtype == np.float32

def test_8k_to_16k():
    x = np.zeros(8000, dtype=np.float32)
    y = to_mono_16k(x, 8000)
    assert len(y) == 16000

def test_invalid_rate():
    try:
        to_mono_16k(np.zeros(10, dtype=np.float32), 0)
    except ValueError:
        return
    raise AssertionError("Expected ValueError")
