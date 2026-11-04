// Vanguard Update Manager, stage 4 (D-037): applies a verified update while the game is closed.
// Built with the C# compiler in Windows' .NET Framework (scripts/build-updater.mjs); no installer or
// other toolchain, and .NET Framework 4 is part of Windows 10 and 11. C# 5 only, for that compiler.
//
//   VanguardUpdater.exe apply <plan file> <game pid> [--test]
//   VanguardUpdater.exe restore <state folder> <game pid> <interrupted|manual> [--test]
//
// The game checks the signature of the manifest before it starts this program. The plan it writes
// lists the files and their hashes; this program checks them again and refuses unsafe paths itself.
//
// The order is what makes it safe:
//   1. wait for the game to close, then verify every staged file: on failure nothing has changed;
//   2. copy what will be replaced to backup.new, then make that the one kept backup;
//   3. only then write the in-progress marker, so a marker always means a complete backup exists;
//   4. replace each file by renaming a verified copy into place, so a file is never half written;
//   5. verify the result and remove the marker, or restore the backup.
// A crash during 4 leaves the marker: the game sees it on its next start and runs `restore`.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("Vanguard Sim Updater")]
[assembly: System.Reflection.AssemblyProduct("Vanguard Sim")]

static class Updater
{
    const int EXIT_DONE = 0;
    const int EXIT_NOTHING_CHANGED = 1;
    const int EXIT_ROLLED_BACK = 2;
    const int EXIT_RESTORE_FAILED = 3;

    const string TMP_DIR = ".vgupdate";
    const string MARKER = "in-progress";
    const string BACKUP = "backup";
    const string BACKUP_NEW = "backup.new";
    const string BACKUP_LIST = "backup.txt";
    const string RESULT = "last-result.txt";
    const string LOG = "update.log";
    static readonly string[] PROTECTED = { "cards", "sleeves", "playmats" };
    static readonly UTF8Encoding UTF8 = new UTF8Encoding(false);

    static bool testMode;
    static string logPath;

    class Entry
    {
        public string Path;
        public string Sha256;
        public long Size;
    }

    class Plan
    {
        public string From, To, Install, Staged, State, Exe;
        public readonly List<Entry> Copy = new List<Entry>();
        public readonly List<string> Delete = new List<string>();
        public readonly List<string> Protect = new List<string>(PROTECTED);
    }

    class Backup
    {
        public string From, To, Install, Exe;
        public readonly List<Entry> Restore = new List<Entry>();
        public readonly List<string> Remove = new List<string>();
    }

    [STAThread]
    static int Main(string[] args)
    {
        testMode = Array.IndexOf(args, "--test") >= 0;
        if (args.Length >= 3 && args[0] == "apply") return Apply(args[1], ParsePid(args[2]));
        if (args.Length >= 4 && args[0] == "restore")
            return RestoreCommand(args[1], ParsePid(args[2]), args[3]);
        return EXIT_NOTHING_CHANGED;
    }

    static int ParsePid(string text)
    {
        int pid;
        return int.TryParse(text, out pid) ? pid : 0;
    }

    // ---- apply ----------------------------------------------------------------------------------

    static int Apply(string planFile, int pid)
    {
        Plan plan;
        try
        {
            plan = ReadPlan(planFile);
        }
        catch (Exception e)
        {
            // no state folder is known yet: leave the result next to the plan's parent
            TrySetLog(Path.GetDirectoryName(planFile));
            Log("bad plan: " + e.Message);
            return EXIT_NOTHING_CHANGED;
        }
        TrySetLog(plan.State);
        Log("apply " + plan.From + " -> " + plan.To);

        Backup backup;
        try
        {
            WaitForExit(pid);
            VerifyStaged(plan);
            backup = MakeBackup(plan);
            WriteFile(StateFile(plan.State, MARKER), plan.To + "\n");
        }
        catch (Exception e)
        {
            Log("nothing changed: " + e);
            WriteResult(plan.State, "failed", plan.To, plan.From);
            Restart(plan.Install, plan.Exe, "The update could not start. Your game was not changed.");
            return EXIT_NOTHING_CHANGED;
        }

        try
        {
            string tmp = Path.Combine(plan.Install, TMP_DIR);
            foreach (Entry f in plan.Copy)
            {
                string staged = Under(plan.Staged, f.Path);
                string target = Under(plan.Install, f.Path);
                if (Matches(target, f)) continue;
                PlaceFile(staged, target, f, tmp);
            }
            foreach (string d in plan.Delete) DeleteFile(Under(plan.Install, d));
            foreach (Entry f in plan.Copy)
                if (!Matches(Under(plan.Install, f.Path), f))
                    throw new IOException(f.Path + " is wrong after installing");
            TryDeleteDir(tmp);
            File.Delete(StateFile(plan.State, MARKER));
            WriteResult(plan.State, "ok", plan.To, plan.From);
            Log("installed " + plan.To);
            Restart(plan.Install, plan.Exe, null);
            return EXIT_DONE;
        }
        catch (Exception e)
        {
            Log("install failed, restoring: " + e);
            return RestoreFrom(plan.State, backup, "rolled-back");
        }
    }

    // ---- restore --------------------------------------------------------------------------------

    static int RestoreCommand(string state, int pid, string reason)
    {
        TrySetLog(state);
        Log("restore: " + reason);
        Backup backup;
        try
        {
            WaitForExit(pid);
            backup = ReadBackup(Path.Combine(state, BACKUP));
        }
        catch (Exception e)
        {
            Log("no usable backup: " + e);
            TryDeleteFile(StateFile(state, MARKER));
            WriteResult(state, "restore-failed", "", "");
            Message("The previous version could not be restored. Please download the game again. " +
                "Your decks, settings and card art are safe.");
            return EXIT_RESTORE_FAILED;
        }
        return RestoreFrom(state, backup, reason == "manual" ? "restored" : "interrupted");
    }

    static int RestoreFrom(string state, Backup backup, string resultKind)
    {
        try
        {
            string files = Path.Combine(Path.Combine(state, BACKUP), "files");
            string tmp = Path.Combine(backup.Install, TMP_DIR);
            foreach (Entry f in backup.Restore)
            {
                string target = Under(backup.Install, f.Path);
                if (Matches(target, f)) continue;
                PlaceFile(Under(files, f.Path), target, f, tmp);
            }
            foreach (string r in backup.Remove) DeleteFile(Under(backup.Install, r));
            foreach (Entry f in backup.Restore)
                if (!Matches(Under(backup.Install, f.Path), f))
                    throw new IOException(f.Path + " is wrong after restoring");
            TryDeleteDir(tmp);
            TryDeleteFile(StateFile(state, MARKER));
            // the backup has served: the game is back on the version it came from
            TryDeleteDir(Path.Combine(state, BACKUP));
            WriteResult(state, resultKind, backup.To, backup.From);
            Log("restored " + backup.From);
            Restart(backup.Install, backup.Exe, null);
            return resultKind == "rolled-back" ? EXIT_ROLLED_BACK : EXIT_DONE;
        }
        catch (Exception e)
        {
            Log("restore failed: " + e);
            // the marker goes too: starting the game must not run a failing restore in a loop
            TryDeleteFile(StateFile(state, MARKER));
            WriteResult(state, "restore-failed", backup.To, backup.From);
            Message("The previous version could not be fully restored. Please download the game " +
                "again. Your decks, settings and card art are safe.");
            // each file is whole, old or new, so the game may well still run: let the player see
            Restart(backup.Install, backup.Exe, null);
            return EXIT_RESTORE_FAILED;
        }
    }

    // ---- backup ---------------------------------------------------------------------------------

    static Backup MakeBackup(Plan plan)
    {
        string fresh = Path.Combine(plan.State, BACKUP_NEW);
        if (Directory.Exists(fresh)) Directory.Delete(fresh, true);
        string files = Path.Combine(fresh, "files");
        Directory.CreateDirectory(files);

        Backup b = new Backup { From = plan.From, To = plan.To, Install = plan.Install, Exe = plan.Exe };
        List<string> touched = new List<string>();
        foreach (Entry f in plan.Copy)
        {
            string target = Under(plan.Install, f.Path);
            if (File.Exists(target) && Matches(target, f)) continue;
            touched.Add(f.Path);
        }
        touched.AddRange(plan.Delete);

        foreach (string path in touched)
        {
            string target = Under(plan.Install, path);
            if (File.Exists(target))
            {
                string copy = Under(files, path);
                Directory.CreateDirectory(Path.GetDirectoryName(copy));
                File.Copy(target, copy, true);
                string sha = Sha256(copy);
                if (sha != Sha256(target)) throw new IOException("backup of " + path + " differs");
                b.Restore.Add(new Entry { Path = path, Sha256 = sha, Size = new FileInfo(copy).Length });
            }
            else if (plan.Delete.IndexOf(path) < 0)
            {
                b.Remove.Add(path);
            }
        }

        StringBuilder list = new StringBuilder();
        list.Append("vanguard-update-backup 1\n");
        list.Append("from\t" + b.From + "\nto\t" + b.To + "\ninstall\t" + b.Install + "\nexe\t" + b.Exe + "\n");
        foreach (Entry f in b.Restore) list.Append("restore\t" + f.Path + "\t" + f.Sha256 + "\t" + f.Size + "\n");
        foreach (string r in b.Remove) list.Append("remove\t" + r + "\n");
        WriteFile(Path.Combine(fresh, BACKUP_LIST), list.ToString());

        string kept = Path.Combine(plan.State, BACKUP);
        if (Directory.Exists(kept)) Directory.Delete(kept, true);
        Directory.Move(fresh, kept);
        return b;
    }

    static Backup ReadBackup(string dir)
    {
        string[] lines = File.ReadAllLines(Path.Combine(dir, BACKUP_LIST), UTF8);
        if (lines.Length == 0 || lines[0] != "vanguard-update-backup 1") throw new IOException("bad backup list");
        Backup b = new Backup();
        foreach (string line in lines)
        {
            string[] p = line.Split('\t');
            switch (p[0])
            {
                case "from": b.From = p[1]; break;
                case "to": b.To = p[1]; break;
                case "install": b.Install = p[1]; break;
                case "exe": b.Exe = Safe(p[1], PROTECTED); break;
                case "restore":
                    b.Restore.Add(new Entry { Path = Safe(p[1], PROTECTED), Sha256 = p[2], Size = long.Parse(p[3]) });
                    break;
                case "remove": b.Remove.Add(Safe(p[1], PROTECTED)); break;
            }
        }
        if (b.Install == null || b.Exe == null) throw new IOException("incomplete backup list");
        return b;
    }

    // ---- plan -----------------------------------------------------------------------------------

    static Plan ReadPlan(string file)
    {
        string[] lines = File.ReadAllLines(file, UTF8);
        if (lines.Length == 0 || lines[0] != "vanguard-update-plan 1") throw new IOException("unknown plan format");
        Plan plan = new Plan();
        foreach (string line in lines)
            if (line.StartsWith("protect\t")) plan.Protect.Add(line.Split('\t')[1]);
        string[] protect = plan.Protect.ToArray();
        foreach (string line in lines)
        {
            string[] p = line.Split('\t');
            switch (p[0])
            {
                case "from": plan.From = p[1]; break;
                case "to": plan.To = p[1]; break;
                case "install": plan.Install = p[1]; break;
                case "staged": plan.Staged = p[1]; break;
                case "state": plan.State = p[1]; break;
                case "exe": plan.Exe = Safe(p[1], protect); break;
                case "copy":
                    if (p.Length != 4 || p[2].Length != 64) throw new IOException("bad copy line");
                    plan.Copy.Add(new Entry { Path = Safe(p[1], protect), Sha256 = p[2], Size = long.Parse(p[3]) });
                    break;
                case "delete": plan.Delete.Add(Safe(p[1], protect)); break;
            }
        }
        if (plan.From == null || plan.To == null || plan.Install == null || plan.Staged == null ||
            plan.State == null || plan.Exe == null || plan.Copy.Count == 0)
            throw new IOException("incomplete plan");
        if (!Path.IsPathRooted(plan.Install) || !Directory.Exists(plan.Install))
            throw new IOException("no game folder");
        return plan;
    }

    /** The same rules as `pathProblem` in app/main/updateManifest.cjs. */
    static string Safe(string path, string[] protect)
    {
        if (string.IsNullOrEmpty(path) || path.Length > 240 || path[0] == '/' ||
            path.IndexOfAny(new[] { '\\', ':', '<', '>', '"', '|', '?', '*' }) >= 0)
            throw new IOException("unsafe path: " + path);
        string[] parts = path.Split('/');
        foreach (string part in parts)
        {
            if (part.Length == 0 || part == "." || part == ".." || part.EndsWith(".") || part.EndsWith(" "))
                throw new IOException("unsafe path: " + path);
            foreach (char c in part)
                if (c < 32) throw new IOException("unsafe path: " + path);
            string stem = part.Split('.')[0].ToLowerInvariant();
            if (stem == "con" || stem == "prn" || stem == "aux" || stem == "nul" ||
                (stem.Length == 4 && (stem.StartsWith("com") || stem.StartsWith("lpt")) && char.IsDigit(stem[3])))
                throw new IOException("unsafe path: " + path);
        }
        foreach (string p in protect)
            if (string.Equals(parts[0], p, StringComparison.OrdinalIgnoreCase))
                throw new IOException("player data: " + path);
        return path;
    }

    static void VerifyStaged(Plan plan)
    {
        foreach (Entry f in plan.Copy)
            if (!Matches(Under(plan.Staged, f.Path), f))
                throw new IOException("staged " + f.Path + " does not match the plan");
    }

    // ---- files ----------------------------------------------------------------------------------

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool MoveFileEx(string from, string to, int flags);
    const int MOVEFILE_REPLACE_EXISTING = 1;
    const int MOVEFILE_WRITE_THROUGH = 8;

    static string Under(string root, string relative)
    {
        return Path.Combine(root, relative.Replace('/', Path.DirectorySeparatorChar));
    }

    static string StateFile(string state, string name)
    {
        return Path.Combine(state, name);
    }

    /** Copy to a temporary name on the game's own drive, verify, then rename over the target. */
    static void PlaceFile(string source, string target, Entry f, string tmpDir)
    {
        Directory.CreateDirectory(tmpDir);
        Directory.CreateDirectory(Path.GetDirectoryName(target));
        string tmp = Path.Combine(tmpDir, Guid.NewGuid().ToString("N"));
        File.Copy(source, tmp, true);
        File.SetAttributes(tmp, FileAttributes.Normal);
        if (!Matches(tmp, f)) throw new IOException("copy of " + f.Path + " does not match");
        Retry(delegate
        {
            if (File.Exists(target)) File.SetAttributes(target, FileAttributes.Normal);
            if (!MoveFileEx(tmp, target, MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH))
                throw new IOException("could not replace " + f.Path + " (error " + Marshal.GetLastWin32Error() + ")");
        });
    }

    static void DeleteFile(string path)
    {
        Retry(delegate
        {
            if (!File.Exists(path)) return;
            File.SetAttributes(path, FileAttributes.Normal);
            File.Delete(path);
        });
    }

    /** Antivirus programs and closing game processes hold files for a moment. */
    static void Retry(Action action)
    {
        int attempts = testMode ? 2 : 40;
        for (int i = 1; ; i++)
        {
            try
            {
                action();
                return;
            }
            catch (Exception e)
            {
                if (!(e is IOException || e is UnauthorizedAccessException) || i >= attempts) throw;
                Thread.Sleep(250);
            }
        }
    }

    static bool Matches(string file, Entry f)
    {
        FileInfo info = new FileInfo(file);
        return info.Exists && info.Length == f.Size && Sha256(file) == f.Sha256;
    }

    static string Sha256(string file)
    {
        using (SHA256 sha = SHA256.Create())
        using (FileStream s = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete))
        {
            byte[] hash = sha.ComputeHash(s);
            StringBuilder hex = new StringBuilder(64);
            foreach (byte b in hash) hex.Append(b.ToString("x2"));
            return hex.ToString();
        }
    }

    static void WriteFile(string path, string text)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path));
        File.WriteAllText(path, text, UTF8);
    }

    static void TryDeleteFile(string path)
    {
        try { File.Delete(path); }
        catch (Exception e) { Log("could not delete " + path + ": " + e.Message); }
    }

    static void TryDeleteDir(string path)
    {
        try { if (Directory.Exists(path)) Directory.Delete(path, true); }
        catch (Exception e) { Log("could not delete " + path + ": " + e.Message); }
    }

    // ---- the game process, results, messages ----------------------------------------------------

    static void WaitForExit(int pid)
    {
        if (pid <= 0) return;
        Process game;
        try
        {
            game = Process.GetProcessById(pid);
        }
        catch (ArgumentException)
        {
            return; // already gone
        }
        if (!game.WaitForExit(testMode ? 8000 : 60000)) throw new IOException("the game did not close");
    }

    static void WriteResult(string state, string kind, string to, string from)
    {
        try
        {
            WriteFile(StateFile(state, RESULT), kind + "\t" + to + "\t" + from + "\n");
        }
        catch (Exception e)
        {
            Log("could not write the result: " + e.Message);
        }
    }

    static void Restart(string install, string exe, string message)
    {
        if (testMode) return;
        if (message != null) Log(message);
        try
        {
            ProcessStartInfo start = new ProcessStartInfo(Under(install, exe));
            start.WorkingDirectory = install;
            start.UseShellExecute = false;
            Process.Start(start);
        }
        catch (Exception e)
        {
            Log("could not restart: " + e);
            Message("Please start Vanguard Sim again from its folder:\n" + install);
        }
    }

    static void Message(string text)
    {
        if (testMode) return;
        MessageBox.Show(text, "Vanguard Sim", MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }

    static void TrySetLog(string state)
    {
        try
        {
            Directory.CreateDirectory(state);
            logPath = Path.Combine(state, LOG);
            // one update's worth of history
            if (File.Exists(logPath) && new FileInfo(logPath).Length > 1000000) File.Delete(logPath);
        }
        catch (Exception)
        {
            logPath = null;
        }
    }

    static void Log(string text)
    {
        if (logPath == null) return;
        try
        {
            File.AppendAllText(logPath, DateTime.Now.ToString("s") + " " + text + "\n", UTF8);
        }
        catch (Exception)
        {
            // logging must never stop an update
        }
    }
}
