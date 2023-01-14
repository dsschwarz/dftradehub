import { Col, Row } from "react-bootstrap";
import React from "react";

export const CenterColumn = ({ children }) => {
    return <Row className="justify-content-center p-3 p-md-5">
        <Col className="col-12 col-md-8 col-lg-6">
            {children}
        </Col>
    </Row>
}