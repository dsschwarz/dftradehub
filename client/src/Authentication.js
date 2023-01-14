import { gql, useQuery } from "@apollo/client";
import React from "react";
const { Navigate, useLocation, useNavigate, Link } = require("react-router-dom");


const AUTH_QUERY = gql`
query AuthQuery {
  authUser {
    displayName
    avatars {
        small
    }
  }
}
`;
export const useAuthQuery = () => {
    return useQuery(AUTH_QUERY)
}

export const Authenticated = ({ children }) => {
    const { loading, error, data } = useAuthQuery();

    if (loading) return <p>Loading...</p>;
    if (error) return <p>Error :(</p>;

    const authenticated = !!data.authUser
    if (!authenticated) {
        return <Navigate to={"/"} />
    } else {
        return <>{children}</>
    }
}
