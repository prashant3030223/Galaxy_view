const SOLAR_SYSTEM_DATA = {
  sun: {
    id: "sun",
    name: "Sun",
    type: "star",
    radius: 32,
    color: "#ffca28",
    glowColor: "rgba(255, 160, 0, 0.4)",
    stats: {
      type: "Yellow Dwarf (G2V)",
      diameter: "1,392,700 km",
      mass: "333,000 Earths",
      temperature: "5,500 °C (Surface)",
      rotation: "27 Earth Days",
      age: "4.6 Billion Years"
    },
    description: "The Sun is the star at the center of our Solar System. Its gravity holds the solar system together, keeping everything from the biggest planets to tiny debris in orbit. The connection and interactions between the Sun and Earth drive the seasons, ocean currents, weather, and auroras.",
    moons: [],
    funFacts: [
      "The Sun accounts for 99.86% of the total mass of the entire Solar System.",
      "Light from the Sun takes approximately 8 minutes and 20 seconds to reach Earth.",
      "The Sun's core is estimated to be about 15 million degrees Celsius."
    ]
  },
  planets: [
    {
      id: "mercury",
      name: "Mercury",
      type: "planet",
      radius: 4,
      color: "#d500f9", // Purple-pink orbit accent (NASA style)
      bodyColor: "#b0bec5", // Gray rocky color
      orbit: {
        semiMajorAxis: 60,
        eccentricity: 0.2056,
        period: 88, // Earth days
        inclination: 7.0, // Degrees
        longitudeOfAscendingNode: 48.3,
        argumentOfPerihelion: 29.1,
        color: "rgba(213, 0, 249, 0.25)"
      },
      stats: {
        distance: "0.39 AU (57.9M km)",
        diameter: "4,879 km",
        mass: "0.055 Earths",
        year: "88 Earth Days",
        day: "59 Earth Days",
        temp: "-180°C to 430°C",
        moons: "0"
      },
      description: "The smallest planet in our solar system and nearest to the Sun, Mercury is only slightly larger than Earth's Moon. From the surface of Mercury, the Sun would appear more than three times as large as it does when viewed from Earth, and the sunlight would be as much as seven times brighter.",
      moons: [],
      funFacts: [
        "Despite being closest to the Sun, it is not the hottest planet (Venus is).",
        "Mercury is speedier than any other planet, traveling through space at nearly 47 kilometers per second.",
        "Mercury has a very thin 'exosphere' instead of a traditional atmosphere."
      ]
    },
    {
      id: "venus",
      name: "Venus",
      type: "planet",
      radius: 7,
      color: "#ffab40", // Orange
      bodyColor: "#ffd54f", // Yellow-ish atmosphere color
      orbit: {
        semiMajorAxis: 90,
        eccentricity: 0.0067,
        period: 224.7,
        inclination: 3.39,
        longitudeOfAscendingNode: 76.6,
        argumentOfPerihelion: 54.8,
        color: "rgba(255, 171, 64, 0.25)"
      },
      stats: {
        distance: "0.72 AU (108.2M km)",
        diameter: "12,104 km",
        mass: "0.815 Earths",
        year: "225 Earth Days",
        day: "243 Earth Days",
        temp: "465°C (Average)",
        moons: "0"
      },
      description: "Venus is the second planet from the Sun and our closest planetary neighbor. It's one of the four inner, terrestrial planets, and it's often called Earth's twin because it's similar in size and density. Venus rotates backward on its axis compared to most other planets.",
      moons: [],
      funFacts: [
        "Venus is the hottest planet in our solar system due to a runaway greenhouse effect.",
        "One day on Venus (rotation) is longer than one year (revolution around Sun).",
        "Venus is the second-brightest natural object in the night sky after the Moon."
      ]
    },
    {