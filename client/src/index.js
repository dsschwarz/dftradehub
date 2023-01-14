import React from "react";
import("./App.css")
import App from "./App.js";
import ReactDOM from "react-dom/client";
import {
    ApolloClient,
    InMemoryCache,
    ApolloProvider,
    HttpLink,
} from "@apollo/client";

const customFetch = (uri, options) => {
    const { operationName } = JSON.parse(options.body);
    return fetch(`${uri}/graphql?opname=${operationName}`, options);
};

const link = new HttpLink({ fetch: customFetch });

const client = new ApolloClient({
    link: link,
    cache: new InMemoryCache()
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <ApolloProvider client={client}>
        <App />
    </ApolloProvider>
);
