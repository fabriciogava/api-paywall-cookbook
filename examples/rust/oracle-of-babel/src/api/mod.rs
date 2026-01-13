//! REST API layer for the Oracle of Babel
//!
//! Provides HTTP endpoints for searching text and retrieving pages

use actix_web::{web, App, HttpResponse};
use serde::{Deserialize, Serialize};

use crate::babel::{BabelAddress, BabelLibrary};

/// Request body for the /search endpoint
#[derive(Debug, Deserialize)]
pub struct SearchRequest {
    pub text: String,
}

/// Response for the /search endpoint
#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub address: BabelAddress,
    pub text_length: usize,
    pub padded_length: usize,
}

/// Response for the /page endpoint
#[derive(Debug, Serialize)]
pub struct PageResponse {
    pub text: String,
    pub address: BabelAddress,
}

/// Error response
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

/// Root endpoint - API introduction
async fn index() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "name": "Oracle of Babel",
        "description": "The Oracle reveals the location of any text within the infinite Library of Babel.",
        "endpoints": {
            "/": "API introduction",
            "/health": "Health check",
            "/search": "POST - Find the address of any text (up to 3200 characters)",
            "/page/{hex}/{wall}/{shelf}/{volume}/{page}": "GET - Retrieve the text at an address"
        },
        "alphabet": "abcdefghijklmnopqrstuvwxyz, . (space, letters, comma, period)",
        "page_length": 3200,
        "documentation": "https://libraryofbabel.info/theory.html"
    }))
}

/// Health check endpoint
async fn health() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "operational",
        "library": "infinite"
    }))
}

/// Search for text and return its address
async fn search(body: web::Json<SearchRequest>) -> HttpResponse {
    let text = &body.text;
    let original_length = text.len();
    
    // Log the search request (truncated if too long)
    let display_text = if text.len() > 50 {
        format!("{}...", &text[..50])
    } else {
        text.clone()
    };
    log::info!("Searching for text: \"{}\" ({} chars)", display_text, original_length);
    
    match BabelLibrary::search(text) {
        Ok(address) => {
            log::info!("Found address: {}", address);
            HttpResponse::Ok().json(SearchResponse {
                address,
                text_length: original_length,
                padded_length: crate::babel::PAGE_LENGTH,
            })
        }
        Err(e) => {
            log::warn!("Search failed: {}", e);
            HttpResponse::BadRequest().json(ErrorResponse { error: e.to_string() })
        }
    }
}

/// Path parameters for page retrieval
#[derive(Deserialize)]
pub struct PagePath {
    pub hex: String,
    pub wall: u8,
    pub shelf: u8,
    pub volume: u8,
    pub page: u16,
}

/// Retrieve the text at a specific address
async fn get_page(path: web::Path<PagePath>) -> HttpResponse {
    let address = BabelAddress::new(
        path.hex.clone(),
        path.wall,
        path.shelf,
        path.volume,
        path.page,
    );
    
    log::info!("Retrieving page at: {}", address);
    
    match BabelLibrary::get_page(&address) {
        Ok(text) => {
            log::info!("Retrieved page ({} chars)", text.len());
            HttpResponse::Ok().json(PageResponse { text, address })
        }
        Err(e) => {
            log::warn!("Page retrieval failed: {}", e);
            HttpResponse::BadRequest().json(ErrorResponse { error: e.to_string() })
        }
    }
}


/// Configure the Actix app routes
pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/", web::get().to(index))
        .route("/health", web::get().to(health))
        .route("/search", web::post().to(search))
        .route("/page/{hex}/{wall}/{shelf}/{volume}/{page}", web::get().to(get_page));
}

/// Create the Actix App with all routes configured
pub fn create_app() -> App<impl actix_web::dev::ServiceFactory<
    actix_web::dev::ServiceRequest,
    Config = (),
    Response = actix_web::dev::ServiceResponse,
    Error = actix_web::Error,
    InitError = (),
>> {
    App::new()
        .configure(configure_routes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App};

    #[actix_rt::test]
    async fn test_health_endpoint() {
        let app = test::init_service(
            App::new().configure(configure_routes)
        ).await;
        
        let req = test::TestRequest::get().uri("/health").to_request();
        let resp = test::call_service(&app, req).await;
        
        assert!(resp.status().is_success());
    }

    #[actix_rt::test]
    async fn test_index_endpoint() {
        let app = test::init_service(
            App::new().configure(configure_routes)
        ).await;
        
        let req = test::TestRequest::get().uri("/").to_request();
        let resp = test::call_service(&app, req).await;
        
        assert!(resp.status().is_success());
    }

    #[actix_rt::test]
    async fn test_search_endpoint() {
        let app = test::init_service(
            App::new().configure(configure_routes)
        ).await;
        
        let req = test::TestRequest::post()
            .uri("/search")
            .set_json(serde_json::json!({"text": "hello world"}))
            .to_request();
        let resp = test::call_service(&app, req).await;
        
        assert!(resp.status().is_success());
    }
}
