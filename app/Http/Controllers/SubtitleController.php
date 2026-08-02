<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\UploadSubtitleRequest;
use App\Models\Room;
use App\Models\SubtitleTrack;
use App\Services\SubtitleConverterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

class SubtitleController extends Controller
{
    public function __construct(
        private readonly SubtitleConverterService $converter
    ) {}

    public function index(Request $request, Room $room): JsonResponse
    {
        $this->authorize('memberAccess', $room);

        $tracks = $room->subtitleTracks()
            ->orderBy('created_at', 'desc')
            ->get(['id', 'label', 'language', 'original_extension', 'created_at']);

        return response()->json($tracks);
    }

    public function store(UploadSubtitleRequest $request, Room $room): JsonResponse
    {
        $this->authorize('update', $room);

        $file = $request->file('file');
        $extension = strtolower($file->getClientOriginalExtension());
        $content = $file->get();

        $vttContent = $this->converter->convertToVtt($content, $extension);

        $label = $request->input('label', $file->getClientOriginalName());
        $language = $request->input('language', 'fa');

        $filename = sprintf('%d_%s.vtt', time(), substr(md5($label), 0, 8));
        $path = sprintf('subtitles/%d/%s', $room->id, $filename);

        Storage::disk('public')->put($path, $vttContent);

        $track = SubtitleTrack::create([
            'room_id' => $room->id,
            'user_id' => $request->user()->id,
            'label' => $label,
            'language' => $language,
            'file_path' => $path,
            'original_extension' => $extension,
        ]);

        return response()->json($track, 201);
    }

    public function show(Request $request, Room $room, SubtitleTrack $track): Response
    {
        $this->authorize('memberAccess', $room);

        abort_if($track->room_id !== $room->id, 404);

        if (! Storage::disk('public')->exists($track->file_path)) {
            abort(404, 'Subtitle file not found.');
        }

        $content = Storage::disk('public')->get($track->file_path);

        return response($content, 200, [
            'Content-Type' => 'text/vtt; charset=utf-8',
            'Content-Disposition' => 'inline; filename="subtitles.vtt"',
        ]);
    }

    public function cues(Request $request, Room $room, SubtitleTrack $track): JsonResponse
    {
        $this->authorize('memberAccess', $room);

        abort_if($track->room_id !== $room->id, 404);

        if (! Storage::disk('public')->exists($track->file_path)) {
            return response()->json(['cues' => []]);
        }

        $content = Storage::disk('public')->get($track->file_path);
        $cues = $this->converter->extractCues($content);

        return response()->json(['cues' => $cues]);
    }

    public function destroy(Request $request, Room $room, SubtitleTrack $track): JsonResponse
    {
        $this->authorize('update', $room);

        abort_if($track->room_id !== $room->id, 404);

        $track->delete();
        Storage::disk('public')->delete($track->file_path);

        return response()->json(['status' => 'deleted']);
    }
}
