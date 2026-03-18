import { exec } from "child_process";

export function runGit(
  cwd: string,
  args: string,
  trim = true
): Promise<string | null> {
  return new Promise((resolve) => {
    exec(
      `git ${args}`,
      { cwd, timeout: 5000 },
      (err, stdout) => {
        if (err) {
          resolve(null);
          return;
        }
        resolve(trim ? stdout.trim() : stdout);
      }
    );
  });
}
