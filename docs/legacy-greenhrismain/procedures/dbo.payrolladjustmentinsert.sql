-- =============================================
-- Author:		<Pat Relos>
-- Create date: <11-10-2023>
-- Description:	<use to insert to servicacharge>
-- =============================================
create PROCEDURE  [dbo].[payrolladjustmentinsert]
	-- Add the parameters for the stored procedure here
	@idemployee int,
	@idclient int,
	@iddepartment int,
	@idposition int,
	@amount float,
	@payoutdate date,
	@fromdate date,
	@enddate date


	
AS

BEGIN
SET NOCOUNT ON;
DECLARE @loandate DATE = GETDATE();
DECLARE @loandatestart DATE = GETDATE();

INSERT INTO payrolladjustmenttbl
(	
employee_id
,idclient
,iddepartment
,idposition
,receiveamount
,payoutdate
,fromdate
,enddate
)

VALUES			
(@idemployee
,@idclient	
,@iddepartment
,@idposition
,@amount
,@payoutdate
,@fromdate
,@enddate
)

END
