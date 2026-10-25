grocery = []
projects = []
notes = '0'
favourite = []
daily_task = []

while True:

    grocery.sort(reversed = True)
    projects.sort(reversed = True)
    daily_task.sort(reversed = True)


    print("You've got grocery and projects and daily task checklist and notes")
    a = input("Which one do you want to modify or pin?")
    if (a == "grocery"):
        print(grocery)
        b = input("Add or Delete or Modify?")
        if (b == "add"):
            c = input("What do you want to add in grocery?")    
            grocery.append(c)
        elif (b == "delete"):
            d = input("What do you want to add/delete in grocery?")
            grocery.pop(d)
        elif (b == "favourite"):
            print(grocery)
            f = input("What do you want to pin?")
            if f in grocery:
                favourite.append(f)
            else:
                print("WHAT IS THIS BRO")
        elif (b == "modify"):
            print(grocery)
            g = int(input("What option do you want to cahnge. First is always index 0"))
            h = input("Change it to what?")
            grocery[g] = h
        else:
            print("WHAT IS THIS BRO")

    elif (a == "projects"):
        print(projects)
        b = input("Add or Delete or Modify?")
        if (b == "add"):
            c = input("What do you want to add in projects?")    
            grocery.append(c)
        elif (b == "delete"):
            d = input("What do you want to add/delete in projects?")
            grocery.pop(d)
        elif (b == "favourite"):
            print(grocery)
            f = input("What do you want to pin?")
            if f in projects:
                favourite.append(f)
            else:
                print("WHAT IS THIS BRO")

        elif (b == "modify"):
            print(grocery)
            g = int(input("What option do you want to cahnge. First is always index 0"))
            h = input("Change it to what?")
            projects[g] = h
        else:
            print("WHAT IS THIS BRO")

    elif (a == "daily_task"):
        print(projects)
        b = input("Add or Delete or Modify?")
        if (b == "add"):
            c = input("What do you want to add in projects?")    
            daily_task.append(c)
        elif (b == "delete"):
            d = input("What do you want to add/delete in projects?")
            daily_task.pop(d)
        elif (b == "favourite"):
            print(grocery)
            f = input("What do you want to pin?")
            if f in daily_task:
                favourite.append(f)
            else:
                print("WHAT IS THIS BRO")

        elif (b == "modify"):
            print(grocery)
            g = int(input("What option do you want to cahnge. First is always index 0"))
            h = input("Change it to what?")
            projects[g] = h
        else:
            print("WHAT IS THIS BRO")

    elif (a == "notes"):
        notes = input("What do you want to write in notes?")
        with open ("notes.txt", "a") as f:
            f.write(notes)

    elif (a == "favourite"):
        print(favourite)
        print("Do you want to delete anything?")
        g = input("[Y/n]")
        if(input == "Y"):
            print(favourite)
            f = ("What do you want to delete")
            if f in favourite:
                favourite.pop(f)

    elif (a == "about"):
        print("Reminder-Notes-App Version 0.3")
        print("Made by ZileLai")
        print("This project is in BETA Version")

    else:
        print("WHAT IS THIS BRO")
