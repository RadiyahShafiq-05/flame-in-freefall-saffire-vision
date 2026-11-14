import cv2
def to_gray(img): return img if img.ndim == 2 else cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
def resize_for_display(img, max_dim=1024):
    h, w = img.shape[:2]; s = max_dim / max(h, w)
    return img if s >= 1 else cv2.resize(img, (int(w*s), int(h*s)), interpolation=cv2.INTER_AREA)
def enhance_contrast(img): return cv2.createCLAHE(2.0, (8, 8)).apply(to_gray(img))
def denoise(img): return cv2.GaussianBlur(img, (5, 5), 0)
def normalize(img): return cv2.normalize(to_gray(img), None, 0, 255, cv2.NORM_MINMAX)
OPS = {"grayscale": lambda i, m: to_gray(i), "contrast": lambda i, m: enhance_contrast(i),
       "denoise": lambda i, m: denoise(i), "normalize": lambda i, m: normalize(i),
       "resize": lambda i, m: resize_for_display(i, m)}
def apply(op: str, img, max_dim=1024):
    return OPS[op](img.copy(), max_dim)  # never mutates the original
