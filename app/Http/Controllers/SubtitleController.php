<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Events\SubtitleDefaultChanged;
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
    /**
     * Subtitle files are stored on the non-public `local` disk so they are
     * only ever retrievable through the authenticated, room-scoped endpoints
     * below — never directly via a public URL.
     */
    private const SUBTITLE_DISK = 'local';

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

    public function default(Request $request, Room $room): JsonResponse
    {
        $this->authorize('memberAccess', $room);

        return response()->json([
            'default_track_id' => $room->active_subtitle_track_id,
        ]);
    }

    public function setDefault(Request $request, Room $room): JsonResponse
    {
        $this->authorize('update', $room);

        $validated = $request->validate([
            'track_id' => 'nullable|integer',
        ]);

        $trackId = $validated['track_id'];

        if ($trackId !== null) {
            $trackExists = $room->subtitleTracks()->whereKey($trackId)->exists();

            if (! $trackExists) {
                return response()->json([
                    'message' => 'Subtitle track not found in this room.',
                ], 404);
            }
        }

        $room->update(['active_subtitle_track_id' => $trackId]);

        broadcast(new SubtitleDefaultChanged($room, $trackId, $request->user()->id));

        return response()->json([
            'default_track_id' => $trackId,
        ]);
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

        Storage::disk(self::SUBTITLE_DISK)->put($path, $vttContent);

        $track = SubtitleTrack::create([
            'room_id' => $room->id,
            'user_id' => $request->user()->id,
            'label' => $label,
            'language' => $language,
            'file_path' => $path,
            'original_extension' => $extension,
        ]);

        return response()->json($track->only([
            'id',
            'room_id',
            'label',
            'language',
            'original_extension',
            'created_at',
            'updated_at',
        ]), 201);
    }

    public function show(Request $request, Room $room, SubtitleTrack $track): Response
    {
        $this->authorize('memberAccess', $room);

        abort_if($track->room_id !== $room->id, 404);

        if (! Storage::disk(self::SUBTITLE_DISK)->exists($track->file_path)) {
            abort(404, 'Subtitle file not found.');
        }

        $content = Storage::disk(self::SUBTITLE_DISK)->get($track->file_path);

        return response($content, 200, [
            'Content-Type' => 'text/vtt; charset=utf-8',
            'Content-Disposition' => 'inline; filename="subtitles.vtt"',
        ]);
    }

    public function cues(Request $request, Room $room, SubtitleTrack $track): JsonResponse
    {
        $this->authorize('memberAccess', $room);

        abort_if($track->room_id !== $room->id, 404);

        if (! Storage::disk(self::SUBTITLE_DISK)->exists($track->file_path)) {
            return response()->json(['cues' => []]);
        }

        $content = Storage::disk(self::SUBTITLE_DISK)->get($track->file_path);
        $cues = $this->converter->extractCues($content);

        return response()->json(['cues' => $cues]);
    }

    public function destroy(Request $request, Room $room, SubtitleTrack $track): JsonResponse
    {
        $this->authorize('update', $room);

        abort_if($track->room_id !== $room->id, 404);

        if ($room->active_subtitle_track_id === $track->id) {
            $room->update(['active_subtitle_track_id' => null]);
            broadcast(new SubtitleDefaultChanged($room, null, $request->user()->id));
        }

        $track->delete();
        Storage::disk(self::SUBTITLE_DISK)->delete($track->file_path);

        return response()->json(['status' => 'deleted']);
    }
}
