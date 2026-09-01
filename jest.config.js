module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@react-native-async-storage/async-storage$":
      "@react-native-async-storage/async-storage/jest/async-storage-mock",
    "^@/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/", "/.maestro/"],
  collectCoverageFrom: ["services/**/*.ts", "utils/**/*.ts"],
};
