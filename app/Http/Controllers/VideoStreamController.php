<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Room;
use App\Services\VideoProxyService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VideoStreamController extends Controller
{
    public function __construct(
        private readonly VideoProxyService $proxy,
    ) {}

    public function __invoke(Request $request, Room $room): Response
    {
        $this->authorize('memberAccess', $room);

        $videoUrl = $room->video_url;

        if ($videoUrl === null || $videoUrl === '') {
            return response()->stream(function (): void {
                echo json_encode(['error' => 'No video source configured.']);
            }, 404, ['Content-Type' => 'application/json']);
        }

        return $this->proxy->stream($request, $videoUrl);
    }
}
