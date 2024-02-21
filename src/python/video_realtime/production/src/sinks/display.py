from common.structs import Frame

import cv2

class DisplaySink:
    def __init__(self, window_name: str):
        self.window_name = window_name

    def open(self):
        pass

    def close(self):
        cv2.destroyAllWindows()

    def __call__(self, frame: Frame):
        # Display the frame.
        cv2.imshow(self.window_name, frame.as_bgr())
        # Quit if the user has pressed 'q'
        if cv2.waitKey(1) & 0xFF == ord('q'):
            raise KeyboardInterrupt

    