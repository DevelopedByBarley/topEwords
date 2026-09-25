<?php

use App\Http\Controllers\AdminController;
use Illuminate\Support\Facades\Route;

// Az `admin.2fa` megerősített kétlépcsős azonosítást kér (F9C-L2).
Route::middleware(['auth', 'verified', 'can:admin', 'admin.2fa'])->group(function () {
    Route::get('admin', [AdminController::class, 'index'])->name('admin');
    Route::post('admin/access', [AdminController::class, 'setAccess'])->name('admin.access.set');
    Route::post('admin/free-month/{user:email}', [AdminController::class, 'grantFreeMonth'])->name('admin.free-month.grant');
    Route::post('admin/invites', [AdminController::class, 'storeInvite'])->name('admin.invites.store');
    Route::delete('admin/invites/{invite}', [AdminController::class, 'destroyInvite'])->name('admin.invites.destroy');
    Route::patch('admin/reports/{report}', [AdminController::class, 'updateReportStatus'])->name('admin.reports.update-status');
});
