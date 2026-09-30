/**
 * DD Studio - Native FFmpeg Media Transcoding Engine Runner
 * Spawns streaming subprocesses and parses progress (time, duration, speed)
 */

import { spawn } from 'child_process';
import EventEmitter from 'events';

export interface FFmpegProgress {
  frame?: number;
  fps?: number;
  timeSeconds?: number;
  timeString?: string;
  bitrate?: string;
  speed?: string;
  percentage?: number;
}

export interface FFmpegOptions {
  ffmpegBin?: string;
  durationSeconds?: number;
  onProgress?: (progress: FFmpegProgress) => void;
}

export class FFmpegRunner extends EventEmitter {
  private ffmpegBin: string;

  constructor(ffmpegBin = 'ffmpeg') {
    super();
    this.ffmpegBin = ffmpegBin;
  }

  public run(args: string[], options: FFmpegOptions = {}): Promise<{ exitCode: number; stderr: string }> {
    return new Promise((resolve, reject) => {
      const bin = options.ffmpegBin || this.ffmpegBin;
      const child = spawn(bin, args);
      let stderrAcc = '';

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderrAcc += text;

        const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.?\d*)/);
        if (timeMatch) {
          const hours = parseFloat(timeMatch[1]);
          const minutes = parseFloat(timeMatch[2]);
          const seconds = parseFloat(timeMatch[3]);
          const timeSeconds = hours * 3600 + minutes * 60 + seconds;

          let percentage: number | undefined;
          if (options.durationSeconds && options.durationSeconds > 0) {
            percentage = Math.min(100, Math.round((timeSeconds / options.durationSeconds) * 100));
          }

          const progressData: FFmpegProgress = {
            timeSeconds,
            timeString: `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`,
            percentage
          };

          this.emit('progress', progressData);
          if (options.onProgress) {
            options.onProgress(progressData);
          }
        }
      });

      child.on('error', (err) => {
        this.emit('error', err);
        reject(err);
      });

      child.on('close', (code) => {
        if (code === 0) {
          this.emit('completed', { exitCode: 0, stderr: stderrAcc });
          resolve({ exitCode: 0, stderr: stderrAcc });
        } else {
          const err = new Error(`FFmpeg exited with code ${code}: ${stderrAcc.slice(-300)}`);
          this.emit('failed', err);
          reject(err);
        }
      });
    });
  }
}
