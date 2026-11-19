extends Node3D

const SERVER_HOST := "77.42.93.209"
const SERVER_PORT := 28916
const TICK_INTERVAL := 0.1

var server_mode := false
var player: CharacterBody3D
var camera: Camera3D
var opponents: Dictionary = {}
var server_peers: Array[int] = []
var colors := [Color("e35e62"), Color("cbb47c"), Color("7dc6dd"), Color("9da9ff")]
var up_held := false
var down_held := false
var left_held := false
var right_held := false
var jump_request := false
var connected := false
var tick := 0.0
var yaw := 0.0
var label_status: Label
var overlay: Control
var world_container: Node3D
var is_loading := false
var world_ready := false
var pressed := {}

func _ready() -> void:
	server_mode = "--server" in OS.get_cmdline_user_args()
	if server_mode:
		start_server()
		return
	make_scene()
	make_menu()
	if "--auto-connect" in OS.get_cmdline_user_args():
		call_deferred("connect_to_server")

func start_server() -> void:
	var peer := ENetMultiplayerPeer.new()
	var err := peer.create_server(SERVER_PORT, 120)
	if err != OK:
		push_error("BRILL 3D dedicated server could not bind %s: %s" % [SERVER_PORT, err])
		get_tree().quit(3)
		return
	multiplayer.multiplayer_peer = peer
	multiplayer.peer_connected.connect(on_peer_connected)
	multiplayer.peer_disconnected.connect(on_peer_disconnected)
	print("BRILL_3D_SERVER_READY port=%d capacity=120" % SERVER_PORT)

func on_peer_connected(peer_id: int) -> void:
	print("BRILL_3D_PEER_JOIN id=", peer_id)
	for old_id in server_peers:
		announce_peer.rpc_id(peer_id, old_id)
	server_peers.append(peer_id)
	announce_peer.rpc(peer_id)

func on_peer_disconnected(peer_id: int) -> void:
	print("BRILL_3D_PEER_LEFT id=", peer_id)
	server_peers.erase(peer_id)
	remove_peer.rpc(peer_id)

@rpc("authority", "call_remote", "reliable")
func announce_peer(peer_id: int) -> void:
	if server_mode or opponents.has(peer_id) or peer_id == multiplayer.get_unique_id(): return
	spawn_other(peer_id)

@rpc("authority", "call_remote", "reliable")
func remove_peer(peer_id: int) -> void:
	if opponents.has(peer_id):
		opponents[peer_id].queue_free()
		opponents.erase(peer_id)
		refresh_status()

@rpc("any_peer", "call_remote", "unreliable")
func send_position(pos: Vector3, rotation_y: float) -> void:
	if not server_mode: return
	var sender := multiplayer.get_remote_sender_id()
	if sender < 2 or sender > 99999: return
	# Basic sanity boundaries, but not a production anti-cheat system.
	if not pos.is_finite() or pos.length() > 4500.0 or pos.y < -50.0 or pos.y > 200.0: return
	receive_position.rpc(sender, pos, rotation_y)

@rpc("authority", "call_remote", "unreliable")
func receive_position(peer_id: int, pos: Vector3, angle: float) -> void:
	if server_mode or peer_id == multiplayer.get_unique_id(): return
	if not opponents.has(peer_id):spawn_other(peer_id)
	var body: Node3D = opponents[peer_id]
	body.position = body.position.lerp(pos, 0.55)
	body.rotation.y = angle

func connect_to_server() -> void:
	if is_loading:return
	is_loading = true
	label_status.text = "ПОДКЛЮЧЕНИЕ К BRILL 3D…"
	var peer := ENetMultiplayerPeer.new()
	var err := peer.create_client(SERVER_HOST, SERVER_PORT)
	if err != OK:
		is_loading = false
		label_status.text = "ОШИБКА СОЗДАНИЯ СОЕДИНЕНИЯ: %d" % err
		return
	multiplayer.multiplayer_peer = peer
	multiplayer.connected_to_server.connect(_on_connected, CONNECT_ONE_SHOT)
	multiplayer.connection_failed.connect(_on_failed, CONNECT_ONE_SHOT)
	multiplayer.server_disconnected.connect(_on_disconnected)

func _on_connected() -> void:
	connected = true
	is_loading = false
	world_ready = true
	label_status.text = "СОЕДИНЕНО"
	print("BRILL_3D_CLIENT_CONNECTED peer=", multiplayer.get_unique_id())
	overlay.hide()
	refresh_status()

func _on_failed() -> void:
	is_loading = false
	connected = false
	label_status.text = "СЕРВЕР НЕДОСТУПЕН. ПОВТОРИТЬ?"
	print("BRILL_3D_CLIENT_CONNECTION_FAILED")

func _on_disconnected() -> void:
	connected = false
	world_ready = false
	is_loading = false
	if is_instance_valid(overlay):
		overlay.show()
		label_status.text = "СОЕДИНЕНИЕ ПОТЕРЯНО"
	for k in opponents.keys():opponents[k].queue_free()
	opponents.clear()

func _physics_process(delta: float) -> void:
	if server_mode or not is_instance_valid(player) or not connected:return
	var move := Vector2.ZERO
	if up_held or Input.is_action_pressed("ui_up"): move.y += 1
	if down_held or Input.is_action_pressed("ui_down"):move.y -= 1
	if left_held or Input.is_action_pressed("ui_left"):move.x -= 1
	if right_held or Input.is_action_pressed("ui_right"):move.x += 1
	move=move.normalized()
	var velocity := player.velocity
	velocity.x = move.x * 8.2
	velocity.z = -move.y * 8.2
	if player.is_on_floor():
		velocity.y=0
		if jump_request:velocity.y=8.2
	else:velocity.y-=23.0*delta
	player.velocity=velocity
	player.move_and_slide()
	jump_request=false
	if is_instance_valid(camera):
		var goal := player.position + Vector3(0.0, 5.0, 10.5)
		camera.position=camera.position.lerp(goal, minf(delta*7.5,1.0))
		camera.look_at(player.position+Vector3(0,1.25,0))
	tick += delta
	if tick>=TICK_INTERVAL:
		tick=0
		send_position.rpc_id(1,player.position,player.rotation.y)

func make_scene() -> void:
	world_container=Node3D.new()
	world_container.name="BrillCity"
	add_child(world_container)
	var sky := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode=Environment.BG_COLOR
	env.background_color=Color("81c4e9")
	env.ambient_light_source=Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color=Color("e9e7e2")
	env.ambient_light_energy=0.65
	sky.environment=env
	world_container.add_child(sky)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees=Vector3(-55,35,-12)
	sun.light_energy=1.65
	world_container.add_child(sun)
	add_box(Vector3(0,-0.6,0),Vector3(320,1.2,320),Color("668b58"))
	for n in range(-4,5):
		add_box(Vector3(float(n)*35,0.04,0),Vector3(9,0.18,310),Color("373b43"))
		add_box(Vector3(0,0.05,float(n)*35),Vector3(310,0.18,9),Color("373b43"))
	for x in range(-3,4):
		for z in range(-3,4):
			if x==0 and z==0:continue
			var h:float=8.0+float((abs(x*7+z*13)%7)*4)
			var tone:=Color("a6adba") if (x+z)%3==0 else Color("e6d5bc") if (x+z)%3==1 else Color("b9c6cf")
			add_box(Vector3(x*35+17.5,h/2,z*35+17.5),Vector3(17,h,18),tone)
			add_box(Vector3(x*35+17.5,h+0.35,z*35+17.5),Vector3(18,0.7,19),Color("49535f"))
	add_box(Vector3(0,0.1,0),Vector3(20,0.3,20),Color("ceaa6c"))
	for x in [-12,12]:
		for z in [-12,12]:
			add_box(Vector3(x,2,z),Vector3(0.45,4,0.45),Color("56535c"))
			add_box(Vector3(x,4.2,z),Vector3(2.1,0.7,2.1),Color("f7e1b6"))
	player=CharacterBody3D.new()
	player.name="LocalPlayer"
	player.position=Vector3(0,1.5,0)
	player.add_child(capsule_shape())
	player.add_child(character_model(Color("df4c63")))
	world_container.add_child(player)
	camera=Camera3D.new()
	camera.current=true
	camera.fov=69
	camera.position=Vector3(0,6,12)
	world_container.add_child(camera)

func capsule_shape()->CollisionShape3D:
	var collision:=CollisionShape3D.new()
	var capsule:=CapsuleShape3D.new()
	capsule.radius=0.46
	capsule.height=1.9
	collision.shape=capsule
	return collision

func character_model(tint:Color)->MeshInstance3D:
	var mesh:=MeshInstance3D.new()
	var capsule:=CapsuleMesh.new()
	capsule.radius=0.46
	capsule.height=1.9
	mesh.mesh=capsule
	var material:=StandardMaterial3D.new()
	material.albedo_color=tint
	mesh.material_override=material
	return mesh

func spawn_other(peer_id:int)->void:
	if opponents.has(peer_id):return
	var other:=Node3D.new()
	other.name="OtherPlayer_%d"%peer_id
	other.add_child(character_model(colors[peer_id%colors.size()]))
	world_container.add_child(other)
	other.position=Vector3(2.5,1.5,2)
	opponents[peer_id]=other
	refresh_status()

func add_box(pos:Vector3,size:Vector3,tint:Color)->void:
	var mesh:=MeshInstance3D.new()
	var model:=BoxMesh.new()
	model.size=size
	mesh.mesh=model
	mesh.position=pos
	var mat:=StandardMaterial3D.new()
	mat.albedo_color=tint
	mesh.material_override=mat
	world_container.add_child(mesh)
	if size.y>0.4:
		var collider:=StaticBody3D.new()
		var shape:=CollisionShape3D.new()
		var collision:=BoxShape3D.new()
		collision.size=size
		shape.shape=collision
		collider.position=pos
		collider.add_child(shape)
		world_container.add_child(collider)

func make_menu()->void:
	var canvas:=CanvasLayer.new()
	canvas.layer=1
	add_child(canvas)
	var root:=Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	canvas.add_child(root)
	var title:=Label.new()
	title.text="BRILL MULTIPLAYER 3D"
	title.add_theme_font_size_override("font_size",32)
	title.add_theme_color_override("font_color",Color("f8e3bc"))
	title.set_anchors_preset(Control.PRESET_TOP_WIDE)
	title.position=Vector2(24,20)
	root.add_child(title)
	var status:=Label.new()
	status.text="3D ТЕСТ · СОБСТВЕННЫЙ ДВИЖОК GODOT"
	status.add_theme_font_size_override("font_size",17)
	status.add_theme_color_override("font_color",Color("fafafa"))
	status.position=Vector2(25,65)
	root.add_child(status)
	label_status=status
	var controls:=HBoxContainer.new()
	controls.anchor_left=0.02
	controls.anchor_top=1.0
	controls.anchor_bottom=1.0
	controls.offset_top=-160
	controls.offset_right=375
	controls.offset_bottom=-14
	root.add_child(controls)
	var arrows:=GridContainer.new()
	arrows.columns=3
	controls.add_child(arrows)
	for name in ["", "▲", "", "◀", "▼", "▶"]:
		var key:=Button.new()
		key.custom_minimum_size=Vector2(95,62)
		key.text=name
		key.add_theme_font_size_override("font_size",27)
		key.disabled=name==""
		arrows.add_child(key)
		if name!="":
			key.button_down.connect(func():press_key(name,true))
			key.button_up.connect(func():press_key(name,false))
	var jump:=Button.new()
	jump.text="ПРЫЖОК"
	jump.add_theme_font_size_override("font_size",20)
	jump.anchor_left=1
	jump.anchor_right=1
	jump.anchor_top=1
	jump.anchor_bottom=1
	jump.offset_left=-220
	jump.offset_right=-24
	jump.offset_top=-105
	jump.offset_bottom=-23
	jump.button_down.connect(func():jump_request=true)
	root.add_child(jump)
	overlay=PanelContainer.new()
	overlay.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	overlay.custom_minimum_size=Vector2(540,230)
	overlay.position=Vector2(-270,-115)
	root.add_child(overlay)
	var box:=VBoxContainer.new()
	box.add_theme_constant_override("separation",17)
	overlay.add_child(box)
	var heading:=Label.new()
	heading.text="BRILL 3D · ТЕСТОВЫЙ ГОРОД"
	heading.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	heading.add_theme_font_size_override("font_size",23)
	box.add_child(heading)
	var desc:=Label.new()
	desc.text="Собственный 3D-мир и соединение игроков.\nНе San Andreas и не SA-MP."
	desc.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	desc.add_theme_font_size_override("font_size",16)
	box.add_child(desc)
	var join:=Button.new()
	join.text="ИГРАТЬ НА BRILL 3D"
	join.custom_minimum_size=Vector2(460,64)
	join.pressed.connect(connect_to_server)
	box.add_child(join)

func press_key(button:String,down:bool)->void:
	match button:
		"▲":up_held=down
		"▼":down_held=down
		"◀":left_held=down
		"▶":right_held=down

func refresh_status()->void:
	if is_instance_valid(label_status):
		label_status.text="BRILL 3D · ОНЛАЙН: %d · ID: %d" % [opponents.size()+1,multiplayer.get_unique_id()]