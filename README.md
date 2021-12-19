# node-ffmpeg-wrapper
Node.JS FFmpeg wrapper

## Requirements

Install FFmpeg

## Installation

```
npm install node-ffmpeg-wrapper
```

## Usage

```
const node_ffmpeg_wrapper = require('node-ffmpeg-wrapper');

//no need to supply bindir if ffmpeg/ffprobe is in the system PATH
const ffmpeg = new node_ffmpeg_wrapper({bindir: 'C:/ffmpeg/bin'});

//probe file to get streams and other details
ffmpeg.probe({path: '/path/to/media/file.mkv'}, function(err, output) {
    if(err) {
        console.log('Error: ' + err);
    } else {
        console.log(output);
    }
});
```