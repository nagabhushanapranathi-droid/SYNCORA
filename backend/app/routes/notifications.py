from flask import Blueprint, g
from app import db
from app.models.models import Notification
from app.utils.auth import require_auth, csrf_protect
from app.utils.helpers import success_response, error_response

notifications_bp = Blueprint('notifications', __name__)


@notifications_bp.route('', methods=['GET'])
@notifications_bp.route('/', methods=['GET'])
@require_auth
def list_notifications():
    user_id = g.current_user.id
    notifs = Notification.query.filter_by(user_id=user_id).order_by(
        Notification.created_at.desc()
    ).all()
    unread_count = sum(1 for n in notifs if not n.is_read)
    return success_response(data={
        'unread_count': unread_count,
        'notifications': [n.to_dict() for n in notifs]
    })


@notifications_bp.route('/<int:notif_id>/read', methods=['PUT'])
@require_auth
@csrf_protect
def mark_read(notif_id):
    notif = Notification.query.filter_by(id=notif_id, user_id=g.current_user.id).first()
    if not notif:
        return error_response('Notification not found', status=404)
    notif.is_read = True
    db.session.commit()
    return success_response(data=notif.to_dict(), message='Notification marked as read')


@notifications_bp.route('/read-all', methods=['PUT'])
@require_auth
@csrf_protect
def mark_all_read():
    user_id = g.current_user.id
    Notification.query.filter_by(user_id=user_id, is_read=False).update({'is_read': True})
    db.session.commit()
    return success_response(message='All notifications marked as read')
