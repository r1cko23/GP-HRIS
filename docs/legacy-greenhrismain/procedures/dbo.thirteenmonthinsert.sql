-- =============================================
-- Author:		<Pat Relos>
-- Create date: <11-10-2023>
-- Description:	<use to insert data of thirteenmonth>
-- =============================================
CREATE PROCEDURE  [dbo].[thirteenmonthinsert]
	-- Add the parameters for the stored procedure here
	@idemployee int,
	@idclient int,
	@iddepartment int,
	@idposition int,
	@fname nvarchar(50),
	@lname nvarchar(50),
	@mname nvarchar(50),
	@tbasic float,
	@amount float,
	@atmno nvarchar(30),
	@paytype nvarchar(30),
	@thirteenmonthyear nvarchar(4),
	@status nvarchar(30)

	
AS

BEGIN
SET NOCOUNT ON;
DECLARE @loandate DATE = GETDATE();
DECLARE @loandatestart DATE = GETDATE();

INSERT INTO thirteenmonth
(	
employee_id
,idclient
,iddepartment
,idposition
,fname
,lname
,mname
,tbasic
,Amount
,acctno
,paythrough
,thirteenmonthyear
,status


)

VALUES			
(@idemployee
,@idclient	
,@iddepartment
,@idposition
,@fname
,@lname
,@mname
,@tbasic
,@amount
,@atmno
,@paytype
,@thirteenmonthyear
,@status
)

END
