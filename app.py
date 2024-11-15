# Hardcoded credentials
USERNAME = "my_username"
PASSWORD = "my_password"

def authenticate(user, password):
    if user == USERNAME and password == PASSWORD:
        return "Authentication successful!"
    else:
        return "Authentication failed!"

# Example usage
user_input = input("Enter username: ")
password_input = input("Enter password: ")

result = authenticate(user_input, password_input)
print(result)
