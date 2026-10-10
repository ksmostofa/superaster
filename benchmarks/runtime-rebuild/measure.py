#!/usr/bin/env python3
"""Run one command and retain Linux child-resource measurements and exit status."""
import argparse
import datetime
import json
import pathlib
import resource
import subprocess
import sys
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=pathlib.Path, required=True)
parser.add_argument('command', nargs=argparse.REMAINDER)
args = parser.parse_args()
if args.command[:1] == ['--']:
    args.command = args.command[1:]
if not args.command:
    parser.error('a command is required')
if args.output.exists():
    parser.error('resource report already exists; retain it before another attempt')
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
clock = time.monotonic()
exit_code = 127
error = None
try:
    exit_code = subprocess.run(args.command).returncode
except OSError as exc:
    error = {'name': type(exc).__name__, 'message': str(exc)}
finally:
    usage = resource.getrusage(resource.RUSAGE_CHILDREN)
    report = {'started_at': started,
              'finished_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'command': args.command, 'exit_code': exit_code,
              'wall_seconds': time.monotonic() - clock,
              'user_cpu_seconds': usage.ru_utime, 'system_cpu_seconds': usage.ru_stime,
              'linux_child_maxrss_kib': usage.ru_maxrss,
              'maxrss_scope': 'Linux waited-child maximum RSS; not simultaneous process-tree RSS',
              'major_page_faults': usage.ru_majflt, 'minor_page_faults': usage.ru_minflt,
              'filesystem_input_blocks': usage.ru_inblock, 'filesystem_output_blocks': usage.ru_oublock,
              'voluntary_context_switches': usage.ru_nvcsw,
              'involuntary_context_switches': usage.ru_nivcsw}
    if error:
        report['launch_error'] = error
    args.output.write_text(json.dumps(report, indent=2) + '\n')
sys.exit(exit_code if exit_code >= 0 else 128 - exit_code)
