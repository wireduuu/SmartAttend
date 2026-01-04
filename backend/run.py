from app import create_app

app = create_app()

if __name__ == "__main__":
    # Use host=0.0.0.0 if you want network access, otherwise default localhost
    app.run(debug=True)
