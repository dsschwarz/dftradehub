import React from "react";
import { Home } from "./Home";

const { BrowserRouter, Routes, Route } = require("react-router-dom")
const { default: Main } = require("./Main")

const App = () => {
    return <BrowserRouter>
        <Routes>
            <Route path="/" element={<Main />}>
                <Route index element={<Home />} />
            </Route>
        </Routes>
    </BrowserRouter>
}

export default App