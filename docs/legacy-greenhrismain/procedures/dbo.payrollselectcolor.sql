-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-6-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[payrollselectcolor]
	-- Add the parameters for the stored procedure here
	--@keytext varchar(50),
		--@override bit,
		@iddepartment int,
		@idclient int,
		@idemployee int,
		@datestart date,
		@pluscolor int --need for delete process
		
AS
BEGIN
SET NOCOUNT ON;
Declare @countemployee int
Declare @Temployee int

--below checking if more than 2 records 
--SELECT @countemployee= COUNT(Employee_id) from payroll_summary payroll_summary
--WHERE     (Employee_id = @idemployee) AND (idclientp = @idclient) and  (Date_Start = @datestart)

SELECT @countemployee= COUNT(Employee_id) from payroll_summary payroll_summary
WHERE     (Employee_id = @idemployee)  and  (Date_Start = @datestart)

--SELECT @Temployee = CAST(@countemployee as float)-@pluscolor	
SELECT @Temployee = CAST(@countemployee as float)

if @Temployee >1
	Begin
		UPDATE       payroll_summary
		SET          dupstag = N'1'
		WHERE        (Employee_id =@idemployee ) AND (Date_Start = @datestart)
	End

if @Temployee <=1
	begin
		UPDATE       payroll_summary
		SET          dupstag = N'0'
		WHERE        (Employee_id =@idemployee )  AND (Date_Start = @datestart)
	End

END
