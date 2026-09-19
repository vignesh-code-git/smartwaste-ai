from collections import Counter

from detection import analyse_video


video_path = "../../test_videos/clean_Roadside.mp4"


analysis = analyse_video(
    video_path
)


print("\nSmartWaste Detection Results")
print("-----------------------------")


for sample in analysis["samples"]:

    for detection in sample["detections"]:

        print(
            f"{sample['time']:>6.2f}s | "
            f"{detection['label']} | "
            f"{detection['confidence']}"
        )


counts = Counter(
    detection["label"]
    for sample in analysis["samples"]
    for detection in sample["detections"]
)


print("\nSightings by type:", dict(counts))
