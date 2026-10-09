#define MyAppName "REGOS Price Checker"
#define MyAppVersion "1.0.0"

[Setup]
AppId={{7C4E9A21-5B18-4D6F-A3E2-91F0C8D47B55}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=REGOS
DefaultDirName={autopf}\RegosPriceChecker
DisableProgramGroupPage=yes
DisableDirPage=yes
OutputDir=output
OutputBaseFilename=RegosPriceChecker-Setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
UninstallDisplayName={#MyAppName}
CloseApplications=force
RestartApplications=no

[Tasks]
Name: kioskstartup; Description: "Open the price screen when Windows starts"; GroupDescription: "Additional tasks:"

[Dirs]
Name: "{app}\backend\data"; Flags: uninsneveruninstall
Name: "{app}\backend\logs"; Flags: uninsneveruninstall

[Files]
Source: "staging\*"; DestDir: "{app}"; Excludes: "backend\config.json,backend\settings.json"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "staging\backend\config.json"; DestDir: "{app}\backend"; Flags: onlyifdoesntexist uninsneveruninstall
Source: "staging\backend\settings.json"; DestDir: "{app}\backend"; Flags: onlyifdoesntexist uninsneveruninstall

[Icons]
Name: "{commonstartup}\REGOS Price Checker"; Filename: "{app}\RegosPriceChecker.bat"; Tasks: kioskstartup

[Run]
Filename: "{app}\RegosPriceChecker.exe"; Parameters: "install"; Flags: runhidden waituntilterminated
Filename: "{app}\RegosPriceChecker.exe"; Parameters: "start"; Flags: runhidden waituntilterminated

[UninstallRun]
Filename: "{app}\RegosPriceChecker.exe"; Parameters: "stop"; Flags: runhidden waituntilterminated; RunOnceId: "StopRegosPriceChecker"
Filename: "{app}\RegosPriceChecker.exe"; Parameters: "uninstall"; Flags: runhidden waituntilterminated; RunOnceId: "UninstallRegosPriceChecker"

[Code]
procedure StopExistingService();
var
  ResultCode: Integer;
  Wrapper: String;
begin
  Wrapper := ExpandConstant('{app}\RegosPriceChecker.exe');
  if not FileExists(Wrapper) then
    Exit;
  Exec(Wrapper, 'stop', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(1000);
  Exec(Wrapper, 'uninstall', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  StopExistingService();
  Result := '';
end;
