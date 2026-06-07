!macro customInit
  ; Kill any running instance so file locks are released before uninstalling.
  ; taskkill exits non-zero if the process isn't running — that is fine, NSIS continues.
  ExecWait 'taskkill /F /IM "Pokemon Card Tracker.exe"'
  Sleep 1000

  ; Silently remove any previously installed version before installing the new one.
  ; User data in %APPDATA%\poke-card-inventory-tracker\ is NOT removed because
  ; deleteAppDataOnUninstall is false in package.json.
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.gamingtopia.poke-card-inventory-tracker" "UninstallString"
  ${If} $R0 != ""
    ExecWait '"$R0" /S'
    Sleep 1000
  ${EndIf}

  ClearErrors
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.gamingtopia.poke-card-inventory-tracker" "UninstallString"
  ${If} $R0 != ""
    ExecWait '"$R0" /S'
    Sleep 1000
  ${EndIf}
!macroend
