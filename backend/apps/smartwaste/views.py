import cv2
import numpy as np

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .detection import detect_frame


class HealthCheckView(APIView):

    def get(self, request):

        return Response(
            {
                "success": True,
                "message": "SmartWaste API is running."
            },
            status=status.HTTP_200_OK
        )


class FrameDetectionView(APIView):

    def post(self, request):

        frame_file = request.FILES.get("frame")

        if not frame_file:

            return Response(
                {
                    "success": False,
                    "error": "Frame is required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        try:

            frame_bytes = frame_file.read()

            image_array = np.frombuffer(
                frame_bytes,
                dtype=np.uint8
            )

            frame = cv2.imdecode(
                image_array,
                cv2.IMREAD_COLOR
            )

            if frame is None:

                return Response(
                    {
                        "success": False,
                        "error": "Invalid image frame."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            detections = detect_frame(frame)

            return Response(
                {
                    "success": True,
                    "count": len(detections),
                    "detections": detections
                },
                status=status.HTTP_200_OK
            )

        except Exception as error:

            return Response(
                {
                    "success": False,
                    "error": str(error)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )