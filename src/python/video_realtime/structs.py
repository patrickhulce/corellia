from dataclasses import dataclass


@dataclass
class BoundingBox:
    left: int
    top: int
    width: int
    height: int

    # Support enumeration as x, y, w, h
    def __iter__(self):
        return iter([self.left, self.top, self.width, self.height])

