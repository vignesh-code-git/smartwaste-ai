import os
from pathlib import Path

import cv2
from ultralytics import YOLO


# --------------------------------------------------
# MODEL FILES
# --------------------------------------------------
# YOLOE is an open-vocabulary detector and segmenter:
# it finds objects described by text prompts, and
# returns an outline (mask) for each one. The stock
# COCO model has no classes for bags, snack packets,
# cartons or paper, so it cannot find roadside litter.
#
# The prompts below are encoded once by the MobileCLIP
# text encoder and baked into VOCAB_WEIGHTS, so normal
# startup never loads the encoder. Delete VOCAB_WEIGHTS
# after editing the prompts to rebuild it.
# --------------------------------------------------

WEIGHTS_DIR = Path(__file__).resolve().parents[2] / "weights"

BASE_WEIGHTS = WEIGHTS_DIR / "yoloe-26l-seg.pt"

VOCAB_WEIGHTS = WEIGHTS_DIR / "smartwaste-yoloe.pt"


# --------------------------------------------------
# WASTE VOCABULARY
# --------------------------------------------------
# Wording was chosen by scoring prompt sets against
# hand-labelled items in roadside footage:
# - "snack bag" finds chips and crisp packets that
#   "chips packet" or "wrapper" miss entirely, and
#   "red snack bag" stops red packets reading as a
#   pink bag.
# - "pink bag" / "yellow bag" find bags that plain
#   "plastic bag" scores near zero. "blue bag",
#   "white bag" and "plastic wrapper" were dropped:
#   they claimed bottles and crushed cans.
# Several prompts can map to one reported category.
#
# prompt: (category, label, material, min confidence)
# --------------------------------------------------

BAG = ("plastic_bag", "Plastic Bag", "plastic", 0.25)
PACKET = ("snack_packet", "Chips / Snack Packet", "plastic", 0.25)

WASTE_PROMPTS = {
    # Drink cans are often reported as "bottle"
    "bottle": ("bottle", "Bottle / Can", "plastic", 0.25),
    "plastic bag": BAG,
    "pink bag": BAG,
    "yellow bag": BAG,
    "garbage bag": ("garbage_bag", "Garbage Bag", "plastic", 0.30),
    "snack bag": PACKET,
    "red snack bag": PACKET,
    "chips bag": PACKET,
    "cup": ("plastic_cup", "Plastic Cup", "plastic", 0.30),
    "can": ("metal_can", "Beverage Can", "metal", 0.30),
    "carton": ("carton", "Carton / Tetra Pack", "paper", 0.30),
    "paper": ("paper", "Paper Litter", "paper", 0.30),
}


# Scene objects the model is also asked to find, so
# that people, vehicles and vegetation are claimed by
# their own class instead of being mislabelled as
# waste. They are dropped from the results.

BACKGROUND_PROMPTS = [
    "person",
    "car",
    "motorcycle",
    "bicycle",
    "leaf",
    "plant",
    "tree",
    "stone",
]


# --------------------------------------------------
# DETECTION SETTINGS
# --------------------------------------------------

BASE_CONFIDENCE = min(
    threshold for *_, threshold in WASTE_PROMPTS.values()
)

IOU_THRESHOLD = 0.5

IMAGE_SIZE = 960

# Outline points are simplified to within this many
# pixels of the true mask edge, to keep responses small.
OUTLINE_TOLERANCE = 1.5


# --------------------------------------------------
# LOAD MODEL
# --------------------------------------------------

def load_model():

    prompts = list(WASTE_PROMPTS) + BACKGROUND_PROMPTS

    if VOCAB_WEIGHTS.exists():

        vocab_model = YOLO(str(VOCAB_WEIGHTS))

        if list(vocab_model.names.values()) == prompts:
            return vocab_model

    # The text encoder is downloaded to, and loaded
    # from, the working directory.
    working_dir = os.getcwd()
    os.chdir(WEIGHTS_DIR)

    try:
        base_model = YOLO(str(BASE_WEIGHTS))
        base_model.set_classes(prompts)
    finally:
        os.chdir(working_dir)

    # The cached text encoder is only needed to encode
    # prompts, so keep it out of the saved file.
    if hasattr(base_model.model, "clip_model"):
        del base_model.model.clip_model

    base_model.save(str(VOCAB_WEIGHTS))

    return YOLO(str(VOCAB_WEIGHTS))


model = load_model()


# --------------------------------------------------
# DETECT SINGLE FRAME
# --------------------------------------------------

def detect_frame(frame):

    if frame is None:
        return []


    result = model.predict(
        frame,
        conf=BASE_CONFIDENCE,
        iou=IOU_THRESHOLD,
        imgsz=IMAGE_SIZE,
        agnostic_nms=True,
        retina_masks=False,
        verbose=False,
    )[0]


    if result.boxes is None:
        return []


    outlines = (
        result.masks.xy
        if result.masks is not None
        else [None] * len(result.boxes)
    )


    detections = []


    for box, outline in zip(result.boxes, outlines):

        prompt = result.names[int(box.cls[0])]

        waste = WASTE_PROMPTS.get(prompt)


        # Background classes are not waste
        if waste is None:
            continue


        category, label, material, threshold = waste

        confidence = float(box.conf[0])


        if confidence < threshold:
            continue


        x1, y1, x2, y2 = box.xyxy[0].tolist()


        detections.append({

            "class": category,

            "label": label,

            "material": material,

            "confidence": round(confidence, 3),

            "box": {
                "x1": round(x1),
                "y1": round(y1),
                "x2": round(x2),
                "y2": round(y2),
            },

            "outline": simplify_outline(outline),

        })


    detections.sort(
        key=lambda detection: detection["confidence"],
        reverse=True,
    )


    return detections


def simplify_outline(points):

    if points is None or len(points) < 3:
        return []

    contour = points.reshape(-1, 1, 2).astype("float32")

    simplified = cv2.approxPolyDP(
        contour,
        OUTLINE_TOLERANCE,
        True,
    )

    return [
        [round(float(x)), round(float(y))]
        for x, y in simplified.reshape(-1, 2)
    ]


# --------------------------------------------------
# ANALYSE ENTIRE VIDEO
# --------------------------------------------------
# Samples the video at a fixed interval, resizing each
# frame to `width` pixels wide, and returns the same
# structure the frontend builds when it scans footage.

def analyse_video(video_path, step=0.4, width=IMAGE_SIZE, on_progress=None):

    cap = cv2.VideoCapture(str(video_path))


    if not cap.isOpened():

        raise ValueError(
            f"Could not open video: {video_path}"
        )


    fps = cap.get(cv2.CAP_PROP_FPS) or 25

    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    duration = frame_count / fps

    source_width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)

    source_height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)

    scale = min(1, width / source_width)

    size = (
        round(source_width * scale),
        round(source_height * scale),
    )


    times = []

    time = 0.0

    while time < duration - 0.05:
        times.append(round(time, 3))
        time += step


    samples = []


    for index, time in enumerate(times):

        cap.set(cv2.CAP_PROP_POS_MSEC, time * 1000)

        success, frame = cap.read()

        if not success:
            break

        frame = cv2.resize(frame, size, interpolation=cv2.INTER_AREA)

        samples.append({
            "time": time,
            "detections": detect_frame(frame),
        })

        if on_progress:
            on_progress(index + 1, len(times))


    cap.release()


    return {
        "duration": round(duration, 3),
        "width": size[0],
        "height": size[1],
        "samples": samples,
    }
