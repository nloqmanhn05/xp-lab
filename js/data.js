/* ==========================================================================
   XP LAB TRAINER - TASK REPOSITORY & ASSETS
   ========================================================================== */

// 42 Core Windows XP System Administration Tasks
// [section, prompt, answer shown, accepted regex (null = self-graded), explanation]
const T = [
  ["run", "Open the Command Prompt from the Run box", "cmd", /^cmd(\.exe)?$/, "Start > Run > cmd"],
  ["run", "Open System Configuration (startup items)", "msconfig", /^msconfig(\.exe)?$/, "Startup tab lists programs loading at boot."],
  ["run", "Open the Registry Editor", "regedit", /^regedit(\.exe)?$/, "Check Run keys for persistence."],
  ["run", "Open the Services console", "services.msc", /^services\.msc$/, "Start, stop and disable services."],
  ["run", "Open Task Manager", "taskmgr", /^taskmgr(\.exe)?$/, "Also Ctrl+Shift+Esc."],
  ["run", "Open Device Manager", "devmgmt.msc", /^devmgmt\.msc$/, "Drivers and hardware."],
  ["run", "Open Computer Management", "compmgmt.msc", /^compmgmt\.msc$/, "Users, disks, services in one console."],
  ["run", "Open Event Viewer", "eventvwr", /^eventvwr(\.msc|\.exe)?$/, "System, Application and Security logs."],
  ["run", "Open Disk Management", "diskmgmt.msc", /^diskmgmt\.msc$/, "Partitions and volumes."],
  ["run", "Open System Information", "msinfo32", /^msinfo32(\.exe)?$/, "Hardware, RAM and OS summary."],
  ["run", "Open the Control Panel", "control", /^control(\.exe)?$/, "Start > Run > control"],
  ["run", "Open Local Security Policy", "secpol.msc", /^secpol\.msc$/, "Password and audit policy."],
  ["run", "Open Add or Remove Programs", "appwiz.cpl", /^appwiz\.cpl$/, "Uninstall software."],
  ["run", "Open Network Connections", "ncpa.cpl", /^ncpa\.cpl$/, "Adapter properties and IP settings."],
  ["cmd", "Copy 2.txt from C:\\Files to C:\\DirFiles", "copy c:\\files\\2.txt c:\\dirfiles", /^copy\s+(c:\\files\\)?2\.txt\s+c:\\dirfiles\\?$/, "copy source destination"],
  ["cmd", "Get the default gateway IP", "ipconfig", /^ipconfig$/, "Look for Default Gateway in the output."],
  ["cmd", "List the files in C:\\Files", "dir c:\\files", /^dir\s+c:\\files\\?$/, "dir lists a folder's contents."],
  ["cmd", "Create a folder named TEST on C:\\", "md c:\\test", /^(md|mkdir)\s+c:\\test$/, "md and mkdir are the same command."],
  ["cmd", "Rename C:\\Files\\1.txt to one.txt", "ren c:\\files\\1.txt one.txt", /^ren(ame)?\s+c:\\files\\1\.txt\s+one\.txt$/, "The new name has no path."],
  ["cmd", "Delete C:\\Files\\3.txt", "del c:\\files\\3.txt", /^(del|erase)\s+c:\\files\\3\.txt$/, "del removes files, not folders."],
  ["cmd", "Remove the folder C:\\TEST", "rd c:\\test", /^(rd|rmdir)\s+c:\\test$/, "rd only removes empty folders."],
  ["cmd", "Change to the root of the drive", "cd \\", /^cd\s*(\\|c:\\)$/, "cd \\ jumps to C:\\."],
  ["cmd", "Show full network config (MAC, DNS)", "ipconfig /all", /^ipconfig\s*\/all$/, "Adds physical address and DNS servers."],
  ["cmd", "Ping the loopback address", "ping 127.0.0.1", /^ping\s+127\.0\.0\.1$/, "Tests the local TCP/IP stack."],
  ["cmd", "List running processes", "tasklist", /^tasklist$/, "Shows image name, PID and memory."],
  ["cmd", "Kill notepad.exe by name", "taskkill /im notepad.exe", /^taskkill\s+(\/f\s+)?\/im\s+notepad\.exe(\s+\/f)?$/, "/im = image name, /pid = process ID."],
  ["cmd", "Show all connections and listening ports (numeric)", "netstat -an", /^netstat\s+-(an|na|ano)$/, "Spot unexpected listeners."],
  ["cmd", "List all files including hidden and system", "dir /a", /^dir\s+\/a$/, "/a shows every attribute."],
  ["cmd", "Display the hosts file", "type c:\\windows\\system32\\drivers\\etc\\hosts", /^type\s+c:\\windows\\system32\\drivers\\etc\\hosts$/, "Malware often edits this file."],
  ["cmd", "Show the computer name", "hostname", /^hostname$/, "One-word answer."],
  ["cmd", "Check disk C: for errors", "chkdsk c:", /^chkdsk(\s+c:)?$/, "Read-only unless you add /f."],
  ["cmd", "Clear the command prompt screen", "cls", /^cls$/, "Clears the console buffer."],
  ["gui", "Find the installed RAM", "Right-click My Computer > Properties > General tab", null, "RAM is listed at the bottom of the General tab."],
  ["gui", "Change the virtual memory (page file) size", "My Computer > Properties > Advanced > Performance Settings > Advanced > Change", null, "Set custom size, then click Set."],
  ["gui", "Change the screen resolution", "Right-click Desktop > Properties > Settings tab", null, "Drag the Screen resolution slider."],
  ["gui", "Find the computer name", "My Computer > Properties > Computer Name tab", null, "Change... renames it."],
  ["gui", "Find the Startup folder", "Start > All Programs > Startup", null, "Programs here run at logon."],
  ["gui", "Turn on Windows Firewall", "Control Panel > Windows Firewall > On (recommended)", null, "General tab."],
  ["gui", "Show hidden files and folders", "My Computer > Tools > Folder Options > View > Show hidden files and folders", null, "Also untick Hide protected operating system files."],
  ["gui", "Set a static IP address", "Network Connections > right-click Local Area Connection > Properties > Internet Protocol (TCP/IP) > Properties", null, "Choose Use the following IP address."],
  ["gui", "Create a new user account", "Control Panel > User Accounts > Create a new account", null, "Choose Computer administrator or Limited."],
  ["gui", "Uninstall a program", "Control Panel > Add or Remove Programs > select > Remove", null, "Same as running appwiz.cpl."]
];

const tasks = T.map((t, i) => ({
  id: i + 1,
  sec: t[0],
  prompt: t[1],
  ans: t[2],
  re: t[3],
  ex: t[4]
}));

const ALT = {
  15: "Explorer: open C:\\Files, right-click 2.txt > Copy, open C:\\DirFiles, right-click > Paste.",
  16: "Network Connections > Local Area Connection > Support tab > Details.",
  17: "Explorer: open C:\\Files to see its contents.",
  18: "Explorer: open C:\\, File > New > Folder, name it TEST.",
  19: "Explorer: right-click 1.txt > Rename, type one.txt.",
  20: "Explorer: select 3.txt and press Delete.",
  21: "Explorer: right-click the TEST folder > Delete."
};

const SEC = {
  all: "All",
  run: "Run commands",
  cmd: "Command prompt",
  gui: "GUI info"
};

// Flat SVG Icons Library (Stroke-based 24x24)
const IC = {
  cards: '<rect x="4" y="6" width="12" height="14" rx="2"/><path d="M8 3h10a2 2 0 0 1 2 2v11"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  term: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9l3 3-3 3M13 15h3"/>',
  flame: '<path d="M12 12c2-3 0-7-1-8 0 3-1.8 4.7-3 6s-2 3.2-2 5a6 6 0 0 0 12 0c0-1.5-1-4-2-5-1.8 3-2.8 3-4 2z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>'
};

const ic = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ""}</svg>`;
