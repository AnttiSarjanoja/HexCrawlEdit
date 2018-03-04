var gulp = require('gulp');
var ts = require('gulp-typescript');

gulp.task('app-typescript', function() {
	return gulp.src(['App.ts'])
    .on('change', function(file) { console.log(file + " changed."); })
    .pipe(ts({
        outFile: "Path.js",
        removeComments: true,
        strictNullChecks: true,
        target: "ES6"
    }))
    .on('error', function(error) { console.log(error); })
	.pipe(gulp.dest('.'));
});
gulp.task('watch-app-ts', function() {
    gulp.watch(['App.ts'], ['app-typescript']);
});

gulp.task('default', ['app-typescript', 'watch-app-ts']);