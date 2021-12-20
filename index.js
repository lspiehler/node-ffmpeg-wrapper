'use strict';

const { spawn } = require( 'child_process' );
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

module.exports = function(options) {
	
	if(options) {
		if(options.bindir) {
			bindir = options.bindir;
		}
    }

    var runCommand = function(params, callback) {
		const stdoutbuff = [];
		const stderrbuff = [];
		var code;
		var exited = false;
		var stdoutrecvd = false;
		var stderrrecvd = true;

        let path = params.bin;

        if(bindir) {
            path = bindir + '/' + path;
        }

        var command = normalizeCommand(params.cmd);
        if(params.hasOwnProperty('in')) {
            command.unshift(params.in);
            command.unshift('-i');
        }

        //console.log(command.join(' '));

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

        try {
            const exec = spawn( path, command);

            if(params.hasOwnProperty('stdin')) {
                if(params.stdin) {
                    exec.stdin.write(params.stdin);
                    //console.log(params.stdin);
                    exec.stdin.end();
                }
            }

            exec.stdout.on('data', function(data) {
                stdoutrecvd = true;
                stdoutbuff.push(data);
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

    this.probe = function(params, callback) {
        let bin = 'ffprobe';
        let cmd = ['-v quiet -print_format json -show_format -show_streams']
        runCommand({ cmd: cmd.join(' '), bin: 'ffprobe', in: params.path}, function(err, out) {
			if(err) {
				callback(err, false, out.command);
			} else {
				callback(false, JSON.parse(out.stdout.toString()), out.command);
			}
		});
    }
}