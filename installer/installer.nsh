; Custom NSIS script include for FSEB
; Provides explicit Windows shell registration for .seb file extension

!macro customInstall
  DetailPrint "Registering FSEB file associations for .seb files..."
  WriteRegStr HKCR ".seb" "" "FSEB.Configuration"
  WriteRegStr HKCR "FSEB.Configuration" "" "FSEB Exam Configuration File"
  WriteRegStr HKCR "FSEB.Configuration\DefaultIcon" "" "$INSTDIR\FSEB.exe,0"
  WriteRegStr HKCR "FSEB.Configuration\shell\open\command" "" '"$INSTDIR\FSEB.exe" "%1"'
  System::Call 'Shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro customUnInstall
  DetailPrint "Removing FSEB file associations..."
  DeleteRegKey HKCR ".seb"
  DeleteRegKey HKCR "FSEB.Configuration"
  System::Call 'Shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

