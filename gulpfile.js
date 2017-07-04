/**
 * Dependencies
 * -----------------------------------------------------------------------------
 */

const autoprefixer = require('autoprefixer');
const babel = require('gulp-babel');
const bs = require('browser-sync');
const changed = require('gulp-changed');
const del = require('del');
const eslint = require('gulp-eslint');
const ghPages = require('gulp-gh-pages');
const gulp = require('gulp');
const gutil = require('gulp-util');
const include = require('gulp-include');
const nano = require('gulp-cssnano');
const plumber = require('gulp-plumber');
const postcss = require('gulp-postcss');
const pug = require('gulp-pug');
const readlineSync = require('readline-sync');
const rename = require('gulp-rename');
const sass = require('gulp-sass');
const sequence = require('run-sequence');
const uglify = require('gulp-uglify');

/**
 * Set paths
 * -----------------------------------------------------------------------------
 */

const path = {
  dist: './dist',
  src: './src',
};

/**
 * Set build options
 * -----------------------------------------------------------------------------
 */

const options = {
  env: process.env.NODE_ENV || 'development',
};

/**
 * Catch stream errors
 * -----------------------------------------------------------------------------
 */

const gulpSrc = gulp.src;

gulp.src = function onError(...args) {
  return gulpSrc
    .apply(gulp, args)
    // Catch errors
    .pipe(plumber((error) => {
      gutil.log(gutil.colors.red(`Error (${error.plugin}):${error.message}`));
      this.emit('end');
    }));
};

/**
 * Default task
 * -----------------------------------------------------------------------------
 */

gulp.task('default', (callback) => {
  sequence(
    ['build'],
    ['server'],
    callback,
  );
});

/**
 * Local dev server with live reload
 * -----------------------------------------------------------------------------
 */

gulp.task('server', () => {
  // Create and initialize local server
  bs.create();
  bs.init({
    notify: false,
    server: path.dist,
    open: 'local',
    ui: false,
  });
  // Watch for source changes and execute associated tasks
  gulp.watch(`${path.src}/fonts/**/*`, ['fonts']);
  gulp.watch(`${path.src}/images/**/*`, ['images']);
  gulp.watch(`${path.src}/media/**/*`, ['media']);
  gulp.watch(`${path.src}/misc/**/*`, ['misc']);
  gulp.watch(`${path.src}/svg/**/*`, ['svg']);
  gulp.watch(`${path.src}/scripts/**/*.js`, ['scripts']);
  gulp.watch(`${path.src}/styles/**/*.scss`, ['styles']);
  gulp.watch(`${path.src}/vendors/*.js`, ['vendors']);
  gulp.watch(`${path.src}/views/**/*.pug`, ['views']);
  // Watch for build changes and reload browser
  bs.watch(`${path.dist}/**/*`).on('change', bs.reload);
});

/**
 * Deploy github pages
 * -----------------------------------------------------------------------------
 */

gulp.task('deployGithubPages', (callback) => {
  if (readlineSync.keyInYN('Do you want to push on Github Pages?')) {
    sequence(
      ['build'],
      ['githubPages'],
      callback,
    );
  }
});

/**
 * Build static assets
 * -----------------------------------------------------------------------------
 */

gulp.task('build', (callback) => {
  sequence(
    ['clean'],
    ['assets'],
    ['scripts'],
    ['styles'],
    ['vendors'],
    ['views'],
    callback,
  );
});

/**
 * Remove build directory
 * -----------------------------------------------------------------------------
 */

gulp.task('clean', () => del(path.dist));

/**
 * Assets
 * -----------------------------------------------------------------------------
 */

gulp.task('assets', (callback) => {
  sequence(
    ['fonts'],
    ['images'],
    ['media'],
    ['misc'],
    ['svg'],
    callback,
  );
});

/**
 * Copy font files
 * -----------------------------------------------------------------------------
 */

gulp.task('fonts', () => gulp
  // Select files
  .src(`${path.src}/fonts/**/*`)
  // Check for changes
  .pipe(changed(`${path.dist}/fonts`))
  // Save files
  .pipe(gulp.dest(`${path.dist}/fonts`)),
);

/**
 * Copy image files
 * -----------------------------------------------------------------------------
 */

gulp.task('images', () => gulp
  // Select files
  .src(`${path.src}/images/**/*`)
  // Check for changes
  .pipe(changed(`${path.dist}/images`))
  // Save files
  .pipe(gulp.dest(`${path.dist}/images`)),
);

/**
 * Copy media files
 * -----------------------------------------------------------------------------
 */

gulp.task('media', () => gulp
  // Select files
  .src(`${path.src}/media/**/*`)
  // Check for changes
  .pipe(changed(`${path.dist}/media`))
  // Save files
  .pipe(gulp.dest(`${path.dist}/media`)),
);

/**
 * Copy misc files
 * -----------------------------------------------------------------------------
 */

gulp.task('misc', () => gulp
  // Select files
  .src([
    `${path.src}/misc/${options.env}/**/*`,
    `${path.src}/misc/all/**/*`,
  ], {
    dot: true,
  })
  // Check for changes
  .pipe(changed(path.dist))
  // Save files
  .pipe(gulp.dest(path.dist)),
);

/**
 * Copy SVG files
 * -----------------------------------------------------------------------------
 */

gulp.task('svg', () => gulp
  // Select files
  .src(`${path.src}/svg/**/*`)
  // Check for changes
  .pipe(changed(`${path.dist}/svg`))
  // Save files
  .pipe(gulp.dest(`${path.dist}/svg`)),
);

/**
 * Build scripts with transpilers
 * -----------------------------------------------------------------------------
 */

gulp.task('scripts', ['scripts-lint'], () => {
  // Select files
  const scripts = gulp.src(`${path.src}/scripts/*.js`)
    // Concatenate includes
    .pipe(include())
    // Transpile
    .pipe(babel());

  if (options.env === 'development') {
    // Save unminified file
    scripts.pipe(gulp.dest(`${path.dist}/scripts`));
  } else {
    // Optimize and minify
    scripts.pipe(uglify())
      // Append suffix
      .pipe(rename({
        suffix: '.min',
      }))
      // Save minified file
      .pipe(gulp.dest(`${path.dist}/scripts`));
  }
});

/**
 * Lint scripts
 * -----------------------------------------------------------------------------
 */

gulp.task('scripts-lint', () => gulp
  // Select files
  .src(`${path.src}/scripts/**/*.js`)
  // Check for errors
  .pipe(eslint())
  // Format errors
  .pipe(eslint.format()),
);

/**
 * Build styles with pre-processors and post-processors
 * -----------------------------------------------------------------------------
 */

gulp.task('styles', () => {
  // Select files
  const styles = gulp.src(`${path.src}/styles/**/*.scss`)
    // Compile Sass
    .pipe(sass({
      outputStyle: 'expanded',
    }))
    // Add vendor prefixes
    .pipe(postcss([
      autoprefixer,
    ]));

  if (options.env === 'development') {
    // Save unminified file
    styles.pipe(gulp.dest(`${path.dist}/styles`));
  } else {
    // Optimize and minify
    styles.pipe(nano())
      // Append suffix
      .pipe(rename({
        suffix: '.min',
      }))
      // Save minified file
      .pipe(gulp.dest(`${path.dist}/styles`));
  }
});

/**
 * Bundle vendors
 * -----------------------------------------------------------------------------
 */

gulp.task('vendors', () => {
  // Select files
  let vendorsSrc;
  if (options.env === 'development') {
    vendorsSrc = [`${path.src}/vendors/*.js`, `!${path.src}/vendors/*.min.js`];
  } else {
    vendorsSrc = `${path.src}/vendors/*.min.js`;
  }
  gulp.src(vendorsSrc)
  // Concatenate includes
    .pipe(include({
      includePaths: [
        `${__dirname}/node_modules`,
      ],
    }))
    // Save files
    .pipe(gulp.dest(`${path.dist}/vendors`));
});

/**
 * Build views with pre-processors
 * -----------------------------------------------------------------------------
 */

gulp.task('views', () => gulp
  // Select files
  .src(`${path.src}/views/site/**/*.pug`)
  // Compile Pug
  .pipe(pug({
    basedir: `${path.src}/views`,
    pretty: (options.env === 'development'),
    data: {
      env: options.env,
    },
  }))
  // Save files
  .pipe(gulp.dest(path.dist)),
);

/**
 * Push production build into gh-pages branche
 * -----------------------------------------------------------------------------
 */

gulp.task('githubPages', () => gulp
  // Select source
  .src(`${path.dist}/**/*`)
  // Deploy on gh-branch
  .pipe(ghPages({
    force: true,
  })),
);
