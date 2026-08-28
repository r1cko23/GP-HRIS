-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-17-2023>
-- Description:	<Employeee ID and Name>
-- =============================================
create PROCEDURE [dbo].[empidandfullname]
@paraidclientp int,
@paraiddepart nchar(10)

AS	

BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	--SET NOCOUNT ON;

   select Employee_id,lname+', '+fname as fullname  from Employee where tagdelete = 'N' order by lname,fname


END

