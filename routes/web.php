<?php

use App\Http\Controllers\ChatController;
use App\Http\Controllers\PlaybackController;
use App\Http\Controllers\PresenceController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\SubtitleController;
use App\Http\Controllers\VideoStreamController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', [RoomController::class, 'index'])->name('dashboard');

    Route::prefix('rooms')->name('rooms.')->group(function () {
        Route::post('/', [RoomController::class, 'store'])->middleware('throttle:room-create')->name('store');
        Route::get('/join/{inviteCode}', [RoomController::class, 'join'])->middleware('throttle:join')->name('join');
        Route::get('/{room}', [RoomController::class, 'show'])->name('show');
        Route::get('/{room}/members', [RoomController::class, 'members'])->name('members');
        Route::patch('/{room}', [RoomController::class, 'update'])->name('update');
        Route::delete('/{room}', [RoomController::class, 'destroy'])->name('destroy');
        Route::post('/{room}/kick/{target}', [RoomController::class, 'kick'])->name('kick');
        Route::post('/{room}/transfer/{target}', [RoomController::class, 'transfer'])->name('transfer');
        Route::post('/{room}/regenerate-invite', [RoomController::class, 'regenerateInviteCode'])->name('regenerate-invite');
        Route::post('/{room}/toggle-lock', [RoomController::class, 'toggleLock'])->name('toggle-lock');
    });

    Route::prefix('playback/{room}')->name('playback.')->group(function () {
        Route::patch('/', [PlaybackController::class, 'update'])->middleware('throttle:playback')->name('update');
        Route::post('/set-video', [PlaybackController::class, 'setVideo'])->middleware('throttle:playback')->name('set-video');
        Route::get('/state', [PlaybackController::class, 'state'])->name('state');
    });

    Route::prefix('chat/{room}')->name('chat.')->group(function () {
        Route::get('/messages', [ChatController::class, 'index'])->name('index');
        Route::post('/messages', [ChatController::class, 'store'])->middleware('throttle:chat')->name('store');
        Route::delete('/messages/{message}', [ChatController::class, 'destroy'])->name('destroy');
    });

    Route::get('/proxy/video/{room}', VideoStreamController::class)->middleware('throttle:proxy')->name('proxy.video');

    Route::prefix('subtitles/{room}')->name('subtitles.')->group(function () {
        Route::get('/', [SubtitleController::class, 'index'])->name('index');
        Route::post('/', [SubtitleController::class, 'store'])->name('store');
        Route::get('/default', [SubtitleController::class, 'default'])->name('default');
        Route::post('/default', [SubtitleController::class, 'setDefault'])->name('set-default');
        Route::get('/{track}', [SubtitleController::class, 'show'])->name('show');
        Route::get('/{track}/cues', [SubtitleController::class, 'cues'])->name('cues');
        Route::delete('/{track}', [SubtitleController::class, 'destroy'])->name('destroy');
    });

    Route::prefix('presence/{room}')->name('presence.')->group(function () {
        Route::post('/heartbeat', [PresenceController::class, 'heartbeat'])->middleware('throttle:presence')->name('heartbeat');
        Route::get('/', [PresenceController::class, 'index'])->name('index');
        Route::post('/leave', [PresenceController::class, 'leave'])->name('leave');
    });

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
