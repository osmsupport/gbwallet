import SERVER_URL from "../contants/server";
import jwtDecode from "jwt-decode";
const tokenKey = "_GB_UserToken";
const axios = require("axios").default;
export function setWithJwt(jwt) {
  localStorage.setItem(tokenKey, jwt);
  return true;
}
export function logout() {
  localStorage.removeItem(tokenKey);
}
export function getCurrentUser() {
  try {
    const jwt = localStorage.getItem(tokenKey);
    return jwtDecode(jwt);
  } catch (ex) {
    return null;
  }
}
export function register(data) {
  return axios.post(SERVER_URL + "/register/create", {
    data: data
  });
}
