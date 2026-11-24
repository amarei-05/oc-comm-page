"""
배경 투명화 스크립트 (단색/밝은 배경용)

사용법:
    python remove_bg.py 입력.png 출력.png [허용오차]

- 이미지 테두리에서 배경색을 추정하고, 테두리와 이어진 배경 영역만 지웁니다.
  (캐릭터 안쪽의 흰 옷 같은 부분은 테두리와 끊겨 있으면 남습니다)
- 허용오차 기본값 18. 배경이 덜 지워지면 올리고, 캐릭터가 깎이면 내리세요.
"""
import sys
import numpy as np
import cv2


def remove_bg(src, dst, tol=18.0):
    img = cv2.imread(src, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise SystemExit(f"이미지를 열 수 없음: {src}")
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

    h, w = img.shape[:2]
    bgr = img[:, :, :3]
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)

    # 테두리 픽셀로 배경색 추정 (중앙값)
    border = np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])
    bg = np.median(border, axis=0)

    dist = np.linalg.norm(lab - bg, axis=2)
    cand = (dist < tol).astype(np.uint8)

    # 테두리와 연결된 후보 영역만 배경으로
    n, labels = cv2.connectedComponents(cand, connectivity=4)
    edge_labels = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])))
    edge_labels.discard(0)
    bg_mask = np.isin(labels, list(edge_labels)) & (cand == 1)

    # 노이즈 정리
    k = np.ones((3, 3), np.uint8)
    fg = (~bg_mask).astype(np.uint8) * 255
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, k)
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, k)

    # 가장자리 부드럽게 + 배경색 번짐(헤일로) 줄이기
    soft = np.clip((dist - tol * 0.6) / (tol * 0.8), 0, 1)
    alpha = fg.astype(np.float32) / 255.0
    edge = cv2.dilate(fg, k, iterations=2) - cv2.erode(fg, k, iterations=2)
    alpha = np.where(edge > 0, np.minimum(alpha + soft * (edge > 0), 1.0) * soft, alpha)
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)

    if img.shape[2] == 4:  # 원래 투명도도 유지
        alpha = alpha * (img[:, :, 3].astype(np.float32) / 255.0)

    out = img.copy()
    out[:, :, 3] = (alpha * 255).astype(np.uint8)

    # 남은 부분만 남기도록 여백 자르기
    ys, xs = np.where(out[:, :, 3] > 8)
    if len(xs):
        pad = 4
        out = out[max(ys.min() - pad, 0):ys.max() + pad + 1, max(xs.min() - pad, 0):xs.max() + pad + 1]

    cv2.imwrite(dst, out)
    print(f"완료: {dst}  ({out.shape[1]}x{out.shape[0]})")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    remove_bg(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 18.0)
