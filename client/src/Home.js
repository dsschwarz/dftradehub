import React from "react";
import { useAuthQuery } from "./Authentication";
import { CenterColumn } from "./Util";
import { Container } from "react-bootstrap";

export const Home = () => {
    const { loading, error, data } = useAuthQuery();

    if (loading) return <p>Loading...</p>;
    if (error) return <p>Error :(</p>;

    if (data.authUser) {
        return <Container>
            Strike the earth!
        </Container>
    }

    return <Container>
        <CenterColumn>
            <h2>Welcome to the DF Trade Hub!</h2>
            <p>
                Sign in with steam to get started
            </p>
            <a href="/api/auth/steam">
                <img alt="Sign in with steam" src="/assets/sits_small.png"></img>
            </a>
        </CenterColumn>
    </Container>
}