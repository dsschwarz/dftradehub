import React from "react";
import "./App.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import { Navbar, Nav, Container, NavDropdown } from "react-bootstrap"
import { Outlet } from "react-router-dom";
import { useAuthQuery } from "./Authentication";

function Main() {
    const { loading, error, data } = useAuthQuery();

    if (loading) return <p>Loading...</p>;
    if (error) return <p>Error :(</p>;

    const accountInfo = data?.authUser
        ? <span>
            <img src={data.authUser.avatars.small}/>
            <span>{data.authUser.displayName}</span>
        </span>
        : null

    return (
        <div className="App h-100 d-flex flex-column">
            <Navbar bg="light" expand="lg">
                <Container>
                    <Navbar.Brand>DF Trade Hub</Navbar.Brand>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
                        <Nav>
                            {
                                accountInfo
                                    ? <NavDropdown title={accountInfo} id="account-nav-dropdown">
                                        <NavDropdown.Item href="/logout">Logout</NavDropdown.Item>
                                    </NavDropdown>
                                    : null
                            }
                        </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>
            <div className="position-relative flex-grow-1">
                <Outlet />
            </div>
        </div>
    );
}

export default Main;