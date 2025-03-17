const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const authJwtController = require('./auth_jwt'); // You're not using authController, consider removing it
const jwt = require('jsonwebtoken');
const cors = require('cors');
const User = require('./Users');
const Movie = require('./Movies'); // You're not using Movie, consider removing it

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

const router = express.Router();

// Removed getJSONObjectForMovieRequirement as it's not used

router.post('/signup', async (req, res) => { // Use async/await
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ success: false, msg: 'Please include both username and password to signup.' }); // 400 Bad Request
  }

  try {
    const user = new User({ // Create user directly with the data
      name: req.body.name,
      username: req.body.username,
      password: req.body.password,
    });

    await user.save(); // Use await with user.save()

    res.status(201).json({ success: true, msg: 'Successfully created new user.' }); // 201 Created
  } catch (err) {
    if (err.code === 11000) { // Strict equality check (===)
      return res.status(409).json({ success: false, message: 'A user with that username already exists.' }); // 409 Conflict
    } else {
      console.error(err); // Log the error for debugging
      return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
    }
  }
});


router.post('/signin', async (req, res) => { // Use async/await
  try {
    const user = await User.findOne({ username: req.body.username }).select('name username password');

    if (!user) {
      return res.status(401).json({ success: false, msg: 'Authentication failed. User not found.' }); // 401 Unauthorized
    }

    const isMatch = await user.comparePassword(req.body.password); // Use await

    if (isMatch) {
      const userToken = { id: user._id, username: user.username }; // Use user._id (standard Mongoose)
      const token = jwt.sign(userToken, process.env.SECRET_KEY, { expiresIn: '1h' }); // Add expiry to the token (e.g., 1 hour)
      res.json({ success: true, token: 'JWT ' + token });
    } else {
      res.status(401).json({ success: false, msg: 'Authentication failed. Incorrect password.' }); // 401 Unauthorized
    }
  } catch (err) {
    console.error(err); // Log the error
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
  }
});

// ===== Movies Endpoints =====

// GET /movies - Retrieve all movies
router.get('/movies', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const movies = await Movie.find();
    res.status(200).json({ success: true, movies });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error retrieving movies' });
  }
});

// POST /movies - Create a new movie
router.post('/movies', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const { title, releaseDate, genre, actors } = req.body;

    // Validate required fields
    if (!title || !releaseDate || !genre || !actors || !Array.isArray(actors) || actors.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required fields or actors array is empty' });
    }

    // Validate each actor
    for (const actor of actors) {
      if (!actor.actorName || !actor.characterName) {
        return res.status(400).json({ success: false, message: 'Each actor must have both actorName and characterName' });
      }
    }

    const newMovie = new Movie({ title, releaseDate, genre, actors });
    await newMovie.save();
    res.status(201).json({ success: true, message: 'Movie created successfully', movie: newMovie });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error creating movie' });
  }
});

// GET /movies/:movieId - Retrieve a specific movie
router.get('/movies/:movieId', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.movieId);
    if (!movie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }
    res.status(200).json({ success: true, movie });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error retrieving movie' });
  }
});

// PUT /movies/:movieId - Update an existing movie
router.put('/movies/:movieId', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const { title, releaseDate, genre, actors } = req.body;

    // If actors is provided, validate it
    if (actors && (!Array.isArray(actors) || actors.length === 0)) {
      return res.status(400).json({ success: false, message: 'Actors array must not be empty if provided' });
    }
    if (actors) {
      for (const actor of actors) {
        if (!actor.actorName || !actor.characterName) {
          return res.status(400).json({ success: false, message: 'Each actor must have both actorName and characterName' });
        }
      }
    }

    const updatedMovie = await Movie.findByIdAndUpdate(
      req.params.movieId,
      { title, releaseDate, genre, actors },
      { new: true, runValidators: true }
    );
    if (!updatedMovie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }
    res.status(200).json({ success: true, message: 'Movie updated successfully', movie: updatedMovie });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error updating movie' });
  }
});

// DELETE /movies/:movieId - Delete a movie
router.delete('/movies/:movieId', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const deletedMovie = await Movie.findByIdAndDelete(req.params.movieId);
    if (!deletedMovie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }
    res.status(200).json({ success: true, message: 'Movie deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error deleting movie' });
  }
});

// If any unsupported HTTP method is used on /movies or /movies/:movieId
router.all('/movies', (req, res) => {
  res.status(405).json({ success: false, message: 'Method not allowed' });
});
router.all('/movies/:movieId', (req, res) => {
  res.status(405).json({ success: false, message: 'Method not allowed' });
});

app.use('/', router);

const PORT = process.env.PORT || 8080; // Define PORT before using it
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // for testing only