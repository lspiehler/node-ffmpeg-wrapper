'use strict';

const { spawn } = require( 'child_process' );
//const { StringDecoder } = require('string_decoder');
const EventEmitter = require('events');
var bindir;

var normalizeCommand = function(command) {
    let cmd = command.split(' ');
    let outcmd = [];
    let cmdbuffer = [];
    for(let i = 0; i <= cmd.length - 1; i++) {
        if(cmd[i].charAt(cmd[i].length - 1) == '\\') {
            cmdbuffer.push(cmd[i]);
        } else {
            if(cmdbuffer.length > 0) {
                outcmd.push(cmdbuffer.join(' ') + ' ' + cmd[i]);
                cmdbuffer.length = 0;
            } else {
                outcmd.push(cmd[i]);
            }
        }
    }
    return outcmd;
}

var binCommand = function() {
    const stdoutbuff = [];
    const stderrbuff = [];
    var code;
    var exited = false;
    var stdoutrecvd = false;
    var stderrrecvd = true;
    var exec;
    var path;
    var command;
    var callback;

    var handleExit = function() {
        var out = {
            command: path + ' ' + command.join(' '),
            stdout: Buffer.concat(stdoutbuff),
            stderr: Buffer.concat(stderrbuff),
            exitcode: code
        }
        if (code != 0) {
            callback(Buffer.concat(stderrbuff).toString(), out);
        } else {
            callback(false, out);
        }
    }

    this.write = function(stdin) {
        exec.stdin.write(stdin);
    }

    this.run = function(params, rtio, endcallback) {
        path = params.bin;
        callback = endcallback;

        if(bindir) {
            path = bindir + '/' + path;
        }

        command = normalizeCommand(params.cmd);
        if(params.hasOwnProperty('in')) {
            for(let i = params.in.length - 1; i >= 0; i--) {
                command.unshift(params.in[i]);
                command.unshift('-i');
            }
        }

        if(params.preinputcmd) {
            let precmd = normalizeCommand(params.preinputcmd);
            for(let i = precmd.length - 1; i >= 0; i--) {
                command.unshift(precmd[i]);
            }
        }

        //console.log(command);
        //console.log(params);

        if(params.hasOwnProperty('out')) {
            //for(let i = 0; i < params.in.length; i++) {
                command.push(params.out);
                //command.unshift('-i');
            //}
        }

        try {
            exec = spawn( path, command);
    
            if(params.hasOwnProperty('stdin')) {
                if(params.stdin) {
                    exec.stdin.write(params.stdin);
                    //console.log(params.stdin);
                    //exec.stdin.end();
                }
            }
    
            exec.stdout.on('data', function(data) {
                //console.log(data.toString());
                stdoutrecvd = true;
                if(rtio) {
                    rtio(data);
                    stdoutbuff[0] = data;
                } else {
                    stdoutbuff.push(data);
                }
                if(exited && code == 0) {
                    handleExit();
                }
            });
    
            exec.on('error', function(err) {
                //console.log(err);
                callback(err, false);
                return;
            });
    
            exec.stderr.on('data', function(data) {
                stderrrecvd = true;
                stderrbuff.push(data);
                if(exited && code != 0) {
                    handleExit();
                }
            });
    
            exec.on('exit', function(ecode) {
                exited = true;
                code = ecode;
                if(stdoutrecvd && ecode == 0) {
                    handleExit();
                }
    
                if(stderrrecvd && ecode != 0) {
                    handleExit();
                }
                
            });
        } catch(e) {
            callback(e, false);
            return;
        }
    }
}

var probe = function(params, callback) {
    var bin = 'ffprobe';
    var cmd = ['-print_format json -show_format -show_streams'];
    var probes = [];
    var index = 0;

    var loopProbe = function(callback) {
        let command = new binCommand();
        command.run({ cmd: cmd.join(' '), bin: bin, in: [params.in[index]]}, false, function(err, out) {
            //console.log(out);
            if(err) {
                callback(err, false);
            } else {
                //out.stdout = out.stdout.toString();
                //out.stderr = out.stderr.toString();
                probes.push({
                    probe: JSON.parse(out.stdout.toString()),
                    cmd: out.command
                });
                index++;
                if(index < params.in.length) {
                    loopProbe(callback);
                } else {
                    callback(false, probes);
                }
            }
        });
    }

    loopProbe(function(err, out, cmd) {
        callback(err, out, cmd);
    });
}

class encoder extends EventEmitter {

    constructor() {
        super();
        this.command;
    }

    sendCommand(cmd) {
        if(this.command) {
            this.command.write(cmd);
            return 0;
        } else {
            return 'encoder isn\'t running yet'
        }
    }

    stop() {
        if(this.command) {
            this.command.write('q');
            return 0;
        } else {
            return 'encoder isn\'t running yet'
        }
    }

    start(params, callback) {
        //const em = new EventEmitter();
        var self = this;
        let bin = 'ffmpeg';
        callback(self);
        new probe({in: params.in}, function(err, inputs) {
            if(err) {
                self.emit('error', err);
            } else {
                let duration = inputs[0].probe.format.duration * 1000;
                let cmd = ['-y'];
                cmd.push(params.cmd);
                cmd.push('-progress -');
                self.command = new binCommand();
                self.command.run({ preinputcmd: params.preinputcmd, cmd: cmd.join(' '), bin: bin, in: params.in, out: params.out},
                function(stdout) {
                    /*if(index++ == 20) {
                        command.write('q');
                    }*/
                    let lines = stdout.toString().split('\n');
                    let progress = {};
                    for(let i = 0; i < lines.length - 1; i++) {
                        let kv = lines[i].split('=');
                        progress[kv[0]] = kv[1];
                    }
                    progress.percent_complete = Math.round((progress.out_time_ms) / duration * 10) / 100;
                    self.emit('progress', progress);
                },
                function(err, out) {
                    //console.log(out);
                    if(err) {
                        self.emit('error', err);
                    } else {
                        self.emit('success', out);
                    }
                });
            }
        });
    }
}

module.exports = function(options) {
	
	if(options) {
		if(options.bindir) {
			bindir = options.bindir;
		}
    }

    this.probe = function(params, callback) {
        new probe(params, function(err, out, cmd) {
            callback(err, out)
        });
    }

    this.encode = function(params, callback) {
        let encode = new encoder();
        //console.log(encode.stop());
        encode.start(params, function(encoder) {
            callback(encoder);
        });
    }
}